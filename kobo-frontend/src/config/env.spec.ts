import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDotEnv, validateEnv } from "./env";

describe("loadDotEnv", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  function envFile(contents: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), "bookcsi-env-"));
    const file = path.join(dir, ".env");
    writeFileSync(file, contents);

    return file;
  }

  it("reads values out of the file", () => {
    delete process.env["PROBE_SAMPLE"];
    loadDotEnv(envFile("PROBE_SAMPLE=from_file\n"));

    expect(process.env["PROBE_SAMPLE"]).toBe("from_file");
  });

  it("lets a real environment variable win over the file", () => {
    // The container case: no `.env` on disk and the values injected. If the
    // file could override them, a stray one would silently beat deployment
    // configuration.
    process.env["PROBE_SAMPLE"] = "from_environment";
    loadDotEnv(envFile("PROBE_SAMPLE=from_file\n"));

    expect(process.env["PROBE_SAMPLE"]).toBe("from_environment");
  });

  it("does nothing when there is no file, because production has none", () => {
    expect(() => loadDotEnv(path.join(tmpdir(), "definitely-absent", ".env"))).not.toThrow();
  });
});

describe("validateEnv", () => {
  it("names every missing variable at once", () => {
    // One boot, one list. Being told about `API_URL` only after fixing
    // `NODE_ENV` turns a single edit into a guessing loop.
    expect(() => validateEnv({})).toThrow(/NODE_ENV[\s\S]*API_URL/);
  });

  it("points at the file to copy", () => {
    expect(() => validateEnv({})).toThrow(/kobo-frontend\/.env.example/);
  });

  it("applies the defaults the example file states", () => {
    const env = validateEnv({
      NODE_ENV: "development",
      API_URL: "http://localhost:3000",
    });

    expect(env.PORT).toBe(4000);
    expect(env.TRUST_PROXY).toBe(0);
  });
});
