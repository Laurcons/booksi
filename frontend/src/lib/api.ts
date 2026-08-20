import { ERROR_CODES, type ErrorCode, type HttpErrorBody } from "@bookcsi/shared";

/**
 * The session lives in an httpOnly cookie (§D20), so every request has to opt
 * into sending credentials — cross-origin fetch drops cookies by default, and
 * in dev the API is a different origin (:3000 vs :5173).
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;

  /**
   * §D27 — present exactly when the API considered this something the user
   * could act on, which is also exactly when `message` was written for them.
   * Absent on the generic 500, and on anything the framework raised without
   * words of our own.
   */
  readonly code: ErrorCode | undefined;

  constructor(status: number, message: string, code?: ErrorCode) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Distinguishable on sight, because a 401 is a routing decision, not a bug. */
export class UnauthorizedError extends ApiError {
  constructor() {
    // The one message in this file, and it is never displayed: `UnauthorizedError`
    // is a routing signal (§D27 — the client redirects on it rather than reading
    // it), so it carries a key for the rare caller that does show it rather than
    // a sentence in one language.
    super(401, "api.sessionExpired", "UNAUTHENTICATED");
    this.name = "UnauthorizedError";
  }
}

/**
 * The sentence to put on screen for a failed request.
 *
 * The rule is §D27's, and it is deliberately **not** "show it if the status is
 * under 500". A coded error carries words written for a person and is shown
 * whatever its status — which is the case that rule got wrong, since an
 * upstream outage is a 5xx that the user can absolutely act on. Everything
 * else gets the caller's own fallback: an uncoded failure has, by definition,
 * nothing addressed to anybody in it, and neither does a network error, which
 * never reached the API at all.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.code !== undefined
    ? error.message
    : fallback;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
  });

  if (res.status === 401) {
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    const { message, code } = await readError(res);
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * The failure, as the API described it (§D27).
 *
 * This used to decide for itself which messages were fit to show, by status:
 * pass 4xx through, replace 5xx with an apology, special-case 429. That rule
 * is gone, and with it two problems. It threw away the one 5xx message that
 * *was* written for a user — "Open Library is down, type it in manually" —
 * and it duplicated wording the server already had, in a client that could
 * only guess at the server's intent.
 *
 * The server now says which it is. Everything here does is carry the code
 * across; `errorMessage` above is where the decision lives, once.
 */
async function readError(
  res: Response,
): Promise<{ message: string; code: ErrorCode | undefined }> {
  try {
    const body = (await res.json()) as Partial<HttpErrorBody>;
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;

    return {
      message: message ?? res.statusText,
      // Guarded rather than trusted: this is the network talking, and an
      // unrecognised code must not be treated as though it were showable.
      code: isErrorCode(body.code) ? body.code : undefined,
    };
  } catch {
    // Not JSON at all — a proxy's error page, a gateway timeout. Nothing here
    // was written for a user, so it gets no code and the caller substitutes.
    return { message: res.statusText, code: undefined };
  }
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value)
  );
}
