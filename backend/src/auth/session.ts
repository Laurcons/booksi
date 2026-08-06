import type { CookieOptions } from "express";

export const SESSION_COOKIE = "session";

/**
 * The session outlives the browser process (S0.2), so the cookie needs an
 * explicit lifetime — a session cookie would be dropped on close.
 */
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * §D20: httpOnly so no injected script can read the token, SameSite=Lax so the
 * cookie still rides along on the top-level redirect coming back from Google.
 *
 * `secure` is off in development because the local API is plain http. It is
 * non-negotiable in production, hence the flag rather than a constant.
 *
 * Logout has to clear the cookie with the same attributes it was set with,
 * which is why this lives in one place.
 */
export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}
