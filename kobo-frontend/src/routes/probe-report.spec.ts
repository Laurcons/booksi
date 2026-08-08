import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
import { createApp } from "../server";
import { REPORTS_DIR } from "./probe-report";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  API_URL: "http://localhost:3000",
  TRUST_PROXY: 0,
};

const app = createApp(env);

// Real files on real disk, same as production — the whole point of this
// route is that a report lands somewhere readable outside the process, so a
// fake filesystem would not actually verify that. Each test cleans up only
// the file it created, by name, rather than clearing the directory: a real
// device report might be sitting there mid-session.
const written: string[] = [];

afterEach(() => {
  for (const file of written.splice(0)) {
    fs.rmSync(file, { force: true });
  }
});

function latestReportFile(): string {
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const name = files[files.length - 1];
  if (name === undefined) {
    throw new Error("no report file was written");
  }
  const full = path.join(REPORTS_DIR, name);
  written.push(full);
  return full;
}

describe("POST /probe/report", () => {
  it("writes the submitted fields to a file on disk", async () => {
    const res = await request(app)
      .post("/probe/report")
      .set("User-Agent", "Kobo Libra Colour")
      .type("form")
      .send({ visual_grey_steps: "7_8", visual_colour: "stins", js_json: "da" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Raport trimis");

    const record = JSON.parse(fs.readFileSync(latestReportFile(), "utf8"));

    expect(record.fields.visual_grey_steps).toBe("7_8");
    expect(record.fields.js_json).toBe("da");
    expect(record.headers["user-agent"]).toBe("Kobo Libra Colour");
  });

  it("records cookie names but never their values", async () => {
    const res = await request(app)
      .post("/probe/report")
      .set("Cookie", "session=super-secret-jwt; ui=lite")
      .type("form")
      .send({});

    expect(res.status).toBe(200);

    const record = JSON.parse(fs.readFileSync(latestReportFile(), "utf8"));
    const raw = fs.readFileSync(
      path.join(REPORTS_DIR, path.basename(written[written.length - 1] ?? "")),
      "utf8",
    );

    expect(record.cookies).toEqual(["session", "ui"]);
    expect(raw).not.toContain("super-secret-jwt");
  });

  it("survives an empty submission", async () => {
    const res = await request(app).post("/probe/report").type("form").send({});

    expect(res.status).toBe(200);
    latestReportFile();
  });
});

describe("GET /probe/reports", () => {
  it("lists a report right after it is submitted", async () => {
    await request(app).post("/probe/report").type("form").send({ visual_svg: "da" });
    const file = latestReportFile();

    const res = await request(app).get("/probe/reports");

    expect(res.status).toBe(200);
    expect(res.text).toContain(path.basename(file));
  });
});
