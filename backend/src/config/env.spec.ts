import { validateEnv } from "./env";

const valid = {
  DATABASE_URL: "mysql://bookcsi:pw@localhost:3306/bookcsi",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_CALLBACK_URL: "http://localhost:3000/auth/google/callback",
  JWT_SECRET: "a-secret-long-enough-to-pass",
  WEB_ORIGIN: "http://localhost:5173",
};

describe("validateEnv", () => {
  it("applies defaults for the optional entries", () => {
    const env = validateEnv({ ...valid });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("names the missing variable instead of failing later at runtime", () => {
    const { GOOGLE_CLIENT_SECRET: _omitted, ...incomplete } = valid;
    expect(() => validateEnv(incomplete)).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("rejects a JWT secret short enough to brute-force", () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: "short" })).toThrow(
      /JWT_SECRET/,
    );
  });
});
