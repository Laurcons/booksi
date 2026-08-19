import { z } from "zod";

/**
 * The error contract, and the rule behind it (§D27).
 *
 * Failures are split by one question — **can the person reading this do
 * something about it?**
 *
 * - **Yes** → an `AppError` on the server: a sentence written for them, plus a
 *   `code` from the list below. The sentence is shown verbatim; the code is
 *   there for the client that needs to *branch* rather than merely display.
 * - **No** → an ordinary `Error`, which the global filter turns into a bare
 *   500. No code, no message, nothing about the inside of the server.
 *
 * **The code is the discriminator, not the status.** That is the whole point
 * of having one. The obvious alternative — "show the message when the status
 * is under 500" — is wrong in a way that is easy to miss until it bites:
 * status codes answer *whose fault is it*, and this contract asks *can the
 * user act*. Those two questions give different answers for an upstream
 * outage, which is not the client's fault (so: 5xx) but is entirely actionable
 * ("Open Library is down, type it in yourself"). Keyed on status, that message
 * gets discarded as though it were a stack frame. Keyed on the code, it
 * arrives.
 */

export const ERROR_CODES = [
  /** A request that does not satisfy the schema, or a cross-field rule. */
  "VALIDATION_FAILED",
  /** Absent, or someone else's — the two are deliberately the same (S0.3). */
  "NOT_FOUND",
  /** No session, or one that is no longer valid (§D23). */
  "UNAUTHENTICATED",
  /** A real session, but not one allowed to use this route (§D38). */
  "FORBIDDEN",
  /** Too many requests too quickly. Actionable: wait. */
  "RATE_LIMITED",
  /**
   * Open Library could not be reached or could not be understood. One code for
   * both, because there is exactly one thing to do about either and a client
   * that branched between them would branch to the same place twice. The
   * status still distinguishes them for whoever reads the logs: 503 for "did
   * not answer", 502 for "answered with something unusable".
   */
  "OPEN_LIBRARY_UNAVAILABLE",
  /** Open Library has no such edition or ISBN. Ordinary, not a fault. */
  "OPEN_LIBRARY_NOT_FOUND",
  /** The uploaded cover is not a JPEG, PNG or WebP (S4.3). */
  "COVER_FORMAT_UNSUPPORTED",
  /** The uploaded cover is over the ceiling (S4.3). */
  "COVER_TOO_LARGE",
  /**
   * The `req` a consent screen was given no longer resolves to anything — it
   * expired (10 minutes, docs/MCP.md §9 step 3), was already used, or was
   * tampered with. Actionable: go back to the assistant and reconnect.
   */
  "MCP_CONSENT_REQUEST_INVALID",
  /**
   * A pairing code or id that does not resolve to anything usable — wrong
   * digits, expired (10 minutes), or already consumed. One code for all
   * three: the action is the same regardless — type it again or get a new
   * one off the Kobo (§Autentificare, docs/kobo_design.md).
   */
  "PAIRING_INVALID",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * What every failed request answers with.
 *
 * `message` is a string for most errors and an array when several rules failed
 * at once — Nest's own convention, and what validation produces.
 *
 * `code` is **absent on exactly one kind of response**: the generic 500. Its
 * absence is therefore meaningful rather than incidental — it says "there is
 * nothing here written for a user", which is precisely when a client should
 * substitute its own words.
 */
export const httpErrorSchema = z.object({
  // Bounded so the generated example is a plausible status rather than the
  // smallest integer a JSON number can hold.
  statusCode: z.number().int().min(400).max(599),
  message: z
    .union([z.string(), z.array(z.string())])
    .meta({ examples: ["Not Found", ["title: Titlul e obligatoriu"]] }),
  code: errorCodeSchema.optional(),
});

export type HttpErrorBody = z.infer<typeof httpErrorSchema>;

/**
 * The generic body's message, which is the one sentence in this file that is
 * *not* a constant any more (§D44): it goes to a reader, so it goes through
 * `errorMessageFor(locale, "error.internal")` like every other one.
 *
 * Named here anyway, as a key rather than a string, because the reason it
 * existed as a single definition has not changed — both ends have to agree on
 * what "no code" says, and the exception filter is the only thing that may send
 * it.
 */
export const INTERNAL_ERROR_KEY = "error.internal" as const;
