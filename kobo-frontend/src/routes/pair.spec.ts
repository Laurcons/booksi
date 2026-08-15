import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
import { createApp } from "../server";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  API_URL: "http://backend.internal",
  TRUST_PROXY: 0,
};

const app = createApp(env);

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/** Reads the cookie a test's own supertest response set, by name. */
function cookieValue(res: request.Response, name: string): string | undefined {
  const cookies = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match?.split(";")[0]?.split("=")[1];
}

describe("pairing by code (docs/kobo_design.md §Autentificare)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /pair", () => {
    it("mints a fresh code and holds its id in a cookie scoped to /pair", async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse(201, {
          id: "pairing-1",
          code: "ABC234",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      );

      const res = await request(app).get("/pair").expect(200);

      expect(res.text).toContain("ABC 234");
      expect(res.text).toContain('href="/pair/continue"');
      // The one action on this page is the primary one — §Culoare.
      expect(res.text).toMatch(/class="btn btn-primary"\s+href="\/pair\/continue"/);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://backend.internal/pairing",
        expect.objectContaining({ method: "POST" }),
      );

      const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
      expect(cookies.some((c) => c.startsWith("kobo_pairing=pairing-1"))).toBe(true);
      expect(cookies.some((c) => c.includes("Path=/pair"))).toBe(true);
      expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
    });

    it("re-shows an existing pending code instead of minting a second one", async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse(200, { status: "pending", code: "ABC234" }),
      );

      const res = await request(app)
        .get("/pair")
        .set("Cookie", "kobo_pairing=pairing-1")
        .expect(200);

      expect(res.text).toContain("ABC 234");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("http://backend.internal/pairing/pairing-1", {
        headers: { "X-Client": "kobo" },
      });
    });

    it("mints a new code when the cookied one has already expired", async () => {
      fetchMock
        .mockReturnValueOnce(jsonResponse(200, { status: "expired", code: "ABC234" }))
        .mockReturnValueOnce(
          jsonResponse(201, {
            id: "pairing-2",
            code: "XYZ987",
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          }),
        );

      const res = await request(app)
        .get("/pair")
        .set("Cookie", "kobo_pairing=pairing-1")
        .expect(200);

      expect(res.text).toContain("XYZ 987");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("shows a plain error page rather than crash when the API is unreachable", async () => {
      fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await request(app).get("/pair").expect(200);

      expect(res.text).toContain("Ceva n-a mers bine");
      expect(res.text).toContain('href="/pair"');
    });
  });

  describe("GET /pair/continue", () => {
    it("sends a device with no pairing cookie back to get a code", async () => {
      const res = await request(app).get("/pair/continue");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows the same waiting page while the code is still pending", async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse(200, { status: "pending", code: "ABC234" }),
      );

      const res = await request(app)
        .get("/pair/continue")
        .set("Cookie", "kobo_pairing=pairing-1")
        .expect(200);

      expect(res.text).toContain("ABC 234");
    });

    it("exchanges an approved pairing for a session cookie and moves on", async () => {
      fetchMock
        .mockReturnValueOnce(jsonResponse(200, { status: "approved", code: "ABC234" }))
        .mockReturnValueOnce(jsonResponse(200, { token: "a-real-jwt" }));

      const res = await request(app)
        .get("/pair/continue")
        .set("Cookie", "kobo_pairing=pairing-1");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/");
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://backend.internal/pairing/pairing-1/consume",
        expect.objectContaining({ method: "POST" }),
      );

      expect(cookieValue(res, "session")).toBe("a-real-jwt");

      const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
      const sessionCookie = cookies.find((c) => c.startsWith("session="));
      expect(sessionCookie).toContain("HttpOnly");
      // The pairing cookie is retired once it has done its job.
      expect(cookies.some((c) => c.startsWith("kobo_pairing=;"))).toBe(true);
    });

    it("clears the cookie and explains when the code expired before approval", async () => {
      fetchMock.mockReturnValueOnce(
        jsonResponse(200, { status: "expired", code: "ABC234" }),
      );

      const res = await request(app)
        .get("/pair/continue")
        .set("Cookie", "kobo_pairing=pairing-1")
        .expect(200);

      expect(res.text).toContain("Codul a expirat");
      const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
      expect(cookies.some((c) => c.startsWith("kobo_pairing=;"))).toBe(true);
    });

    it("treats an already-consumed pairing as success, not an error", async () => {
      // Only reachable by tapping the link twice — the first tap already
      // moved the device on.
      fetchMock.mockReturnValueOnce(
        jsonResponse(200, { status: "consumed", code: "ABC234" }),
      );

      const res = await request(app)
        .get("/pair/continue")
        .set("Cookie", "kobo_pairing=pairing-1");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/");
    });

    it("shows the error page if the API breaks mid-flow rather than a stack trace", async () => {
      fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const res = await request(app)
        .get("/pair/continue")
        .set("Cookie", "kobo_pairing=pairing-1")
        .expect(200);

      expect(res.text).toContain("Ceva n-a mers bine");
    });
  });

  describe("the root path", () => {
    it("sends a device with no session to pair", async () => {
      const res = await request(app).get("/");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends a signed-in device to the book list", async () => {
      const res = await request(app).get("/").set("Cookie", "session=a-real-jwt");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/books");
    });
  });
});
