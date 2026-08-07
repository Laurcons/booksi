import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Raw secret handed to the client (auth code, access token, refresh token).
 * 256 bits, same CSPRNG idiom as `auth/oauth-state.ts`'s `newOAuthState`.
 */
export function mintOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What actually lives in the database. `sha256` rather than bcrypt: the
 * input is already a 32-byte random secret, not a human-chosen password, so
 * a slow hash buys nothing and costs latency on every `/mcp` request
 * (docs/MCP.md §5).
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** RFC 7636's S256 transform: what a `code_verifier` must hash to. */
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Constant-time string comparison, same idiom as `auth/oauth-state.ts`'s
 * `oauthStateMatches` — length-checked first so `timingSafeEqual` never
 * throws (and never leaks the length by doing so).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
