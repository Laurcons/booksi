import type { Response } from "express";
import { BackendUnauthorizedError } from "./backend-client";
import { SESSION_COOKIE } from "./session-cookie";

/**
 * The one response every book route needs to give the same way: a session
 * cookie that the API no longer accepts (expired, logged out elsewhere) is
 * not this page's problem to explain — it is `/pair`'s.
 *
 * Returns whether it handled the error (and already wrote a response), so a
 * caller's `catch` block knows whether to fall through to its own generic
 * error page.
 */
export function handleBackendError(error: unknown, res: Response): boolean {
  if (error instanceof BackendUnauthorizedError) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.redirect(303, "/pair");
    return true;
  }

  return false;
}
