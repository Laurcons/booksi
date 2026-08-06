import { validateEnv } from "./env";

const valid = {
  NODE_ENV: "development",
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
    expect(env.TRUST_PROXY).toBe(0);
  });

  /**
   * The one variable that must not have a default: `Secure` on the session
   * cookie and whether the docs are public both key off it, so defaulting it
   * would make an unset value silently choose the weaker of the two.
   */
  it("refuses to start without NODE_ENV rather than assuming development", () => {
    const { NODE_ENV: _omitted, ...incomplete } = valid;
    expect(() => validateEnv(incomplete)).toThrow(/NODE_ENV/);
  });

  it("refuses to trust a negative number of proxies", () => {
    expect(() => validateEnv({ ...valid, TRUST_PROXY: "-1" })).toThrow(
      /TRUST_PROXY/,
    );
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
