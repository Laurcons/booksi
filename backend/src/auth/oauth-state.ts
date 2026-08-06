import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions } from "express";

/**
 * The OAuth `state` parameter, and why it exists.
 *
 * Without it, `/auth/google/callback` accepts any authorization code that
 * reaches it. An attacker completes the Google flow with *their* account, stops
 * before the last redirect, and gets a victim's browser to visit the callback
 * with that code — the victim is now silently signed in as the attacker, and
 * every book they add lands in the attacker's library. Nothing looks broken;
 * that is what makes it worth defending against.
 *
 * The defence is a nonce the attacker cannot know: it is minted when the flow
 * starts, sent to Google to be handed back verbatim, and kept meanwhile in a
 * cookie only this site can read. A callback whose `state` does not match the
 * cookie did not start here.
 *
 * Passport can do this itself, but only through its session store, and §D20
 * runs passport with `session: false` — the session *is* the JWT cookie. So the
 * nonce gets a cookie of its own rather than a session to live in.
 */
export const OAUTH_STATE_COOKIE = "oauth_state";

/**
 * Long enough to survive a slow consent screen, short enough that an abandoned
 * login does not leave a usable nonce lying around all day.
 */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * `SameSite=Lax` for the same reason the session cookie uses it (§D20): the way
 * back from Google is a top-level redirect, and a `Strict` cookie would not
 * ride along with it — the check would then fail for everybody, every time.
 *
 * Scoped to `/auth`, unlike the session: nothing outside the OAuth routes has
 * any use for it, and a cookie is one more thing sent on every request until
 * you tell it otherwise.
 */
export function oauthStateCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/auth",
    maxAge: STATE_TTL_MS,
  };
}

/** 256 bits from the CSPRNG — not `Math.random`, which is predictable. */
export function newOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Constant-time comparison. The nonce is single-use and expires in ten minutes,
 * so a timing oracle here is not a practical attack — but comparing secrets
 * with `===` is a habit worth not having, and the cost is nil.
 */
export function oauthStateMatches(
  expected: string | undefined,
  received: unknown,
): boolean {
  if (typeof expected !== "string" || typeof received !== "string") {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  // `timingSafeEqual` throws on a length mismatch, which would itself leak the
  // length — so the lengths are compared first and the result is the same
  // `false` either way.
  return a.length === b.length && timingSafeEqual(a, b);
}
