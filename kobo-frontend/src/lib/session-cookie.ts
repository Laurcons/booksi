import type { CookieOptions } from "express";

/**
 * Mirrors `backend/src/auth/session.ts`. Duplicated on purpose, the same
 * shape as `ui-choice.ts` / `docker/kobo-routing.conf` (§D37's own comment on
 * that duplication): this process has to *write* a cookie the backend later
 * *reads*, the two are separate deployables that do not import from each
 * other, and the single domain (§D37) is what makes a cookie written here
 * valid there at all. Changing one copy without the other is the failure
 * mode to watch for — same as the routing rule it sits beside.
 */
export const SESSION_COOKIE = "session";

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}
