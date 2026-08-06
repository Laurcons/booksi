import type { Request } from "express";
import { sessionCookieExtractor } from "./jwt.strategy";
import { SESSION_COOKIE } from "../session";

describe("sessionCookieExtractor", () => {
  it("reads the token from the session cookie", () => {
    const req = { cookies: { [SESSION_COOKIE]: "jwt-value" } } as unknown as Request;
    expect(sessionCookieExtractor(req)).toBe("jwt-value");
  });

  it("ignores an Authorization header (§D20)", () => {
    // Accepting a bearer token would let a JavaScript-readable token back in
    // through the side door.
    const req = {
      cookies: {},
      headers: { authorization: "Bearer jwt-value" },
    } as unknown as Request;
    expect(sessionCookieExtractor(req)).toBeNull();
  });

  it("survives a request that never went through cookie-parser", () => {
    expect(sessionCookieExtractor({} as Request)).toBeNull();
  });
});
