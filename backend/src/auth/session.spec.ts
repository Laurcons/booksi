import { SESSION_TTL_MS, sessionCookieOptions } from "./session";

describe("sessionCookieOptions", () => {
  it("keeps the token out of reach of JavaScript (§D20)", () => {
    const options = sessionCookieOptions(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  it("survives closing the browser (S0.2)", () => {
    // A cookie without maxAge dies with the browser process.
    expect(sessionCookieOptions(false).maxAge).toBe(SESSION_TTL_MS);
  });

  it("is Secure in production and only there", () => {
    expect(sessionCookieOptions(true).secure).toBe(true);
    // Local dev serves the API over plain http; a Secure cookie would never
    // be stored.
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
