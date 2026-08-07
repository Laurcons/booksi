import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
import { createApp } from "../server";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  API_URL: "http://localhost:3000",
  TRUST_PROXY: 0,
};

const app = createApp(env);

const KOBO =
  "Mozilla/5.0 (Linux; U; Android 2.0; en-us;) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1 (Kobo Libra Colour)";

describe("GET /probe", () => {
  it("renders without JavaScript having to run", async () => {
    const res = await request(app).get("/probe").set("User-Agent", KOBO);

    expect(res.status).toBe(200);
    // The whole point of the server-rendered half: the User-Agent is on the
    // page whether or not the engine can execute anything.
    expect(res.text).toContain("Kobo Libra Colour");
    expect(res.text).toContain("lite (motiv: user-agent)");
  });

  it("never prints the session cookie", async () => {
    // A diagnostic page that echoes the Cookie header is a diagnostic page
    // that puts a 30-day JWT on an e-reader screen, and into any photo of one.
    const res = await request(app)
      .get("/probe")
      .set("Cookie", "session=super-secret-jwt; ui=lite");

    expect(res.text).not.toContain("super-secret-jwt");
    // The names are still useful, and safe.
    expect(res.text).toContain("session, ui");
  });

  it("reports the cookie override as the reason when one is set", async () => {
    const res = await request(app)
      .get("/probe")
      .set("User-Agent", "Chrome")
      .set("Cookie", "ui=lite");

    expect(res.text).toContain("lite (motiv: cookie)");
  });

  it("omits the viewport meta when asked, and links back to the other one", async () => {
    const withMeta = await request(app).get("/probe");
    expect(withMeta.text).toContain('name="viewport"');
    expect(withMeta.text).toContain("/probe?noviewport=1");

    const without = await request(app).get("/probe?noviewport=1");
    expect(without.text).not.toContain('name="viewport"');
  });

  it("declares that the response varies by User-Agent and cookie", async () => {
    // Without this a shared cache in front of the proxy can serve the React
    // shell to a Kobo, which is the one failure this whole design must avoid.
    const res = await request(app).get("/probe");

    expect(res.headers["vary"]).toBe("User-Agent, Cookie");
  });

  it("ships an ES3 script — no modern syntax that could fail to parse", async () => {
    const res = await request(app).get("/probe");

    const start = res.text.indexOf("<script>") + "<script>".length;
    const script = res.text.slice(start, res.text.indexOf("</script>", start));

    // The rule is "no modern syntax in code the engine has to *parse*" — but
    // the whole point of the `syntax()` probes is to hand `new Function` a
    // string containing exactly that syntax, so a naive search matches its own
    // detector. Comments and string literals come out first; what is left is
    // the code that actually gets parsed on the device.
    const executable = script
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");

    expect(executable).not.toMatch(/=>/);
    expect(executable).not.toMatch(/\bconst\b/);
    expect(executable).not.toMatch(/\blet\b/);
    expect(executable).not.toMatch(/\bclass\b/);
    expect(executable).not.toMatch(/`/);
    expect(executable).not.toMatch(/\.\.\./);

    // And it is still real code after all that stripping, not an empty string
    // the assertions above would pass trivially.
    expect(executable).toMatch(/\bvar\b/);
    expect(executable.length).toBeGreaterThan(500);
  });
});

describe("GET /ui/:choice", () => {
  it("pins the choice and comes back to the probe", async () => {
    const res = await request(app).get("/ui/lite");

    expect(res.status).toBe(302);
    expect(res.headers["location"]).toBe("/probe");
    expect(res.headers["set-cookie"]?.[0]).toContain("ui=lite");
  });

  it("clears the pin on auto", async () => {
    const res = await request(app).get("/ui/auto");

    expect(res.status).toBe(302);
    expect(res.headers["set-cookie"]?.[0]).toContain("ui=;");
  });

  it("refuses to redirect off-site", async () => {
    // `next` is attacker-controlled, so both an absolute URL and the
    // scheme-relative `//host` form have to fall back to a local path.
    const absolute = await request(app).get("/ui/lite?next=https://elsewhere.example");
    expect(absolute.headers["location"]).toBe("/probe");

    const schemeRelative = await request(app).get("/ui/lite?next=//elsewhere.example");
    expect(schemeRelative.headers["location"]).toBe("/probe");
  });

  it("keeps a local next", async () => {
    const res = await request(app).get("/ui/full?next=/library");

    expect(res.headers["location"]).toBe("/library");
  });
});
