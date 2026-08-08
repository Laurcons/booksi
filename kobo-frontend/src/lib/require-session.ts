import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE } from "./session-cookie";

/** Reads the session cookie off a request, or `undefined` if there is none. */
export function sessionCookieFrom(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
}

/**
 * Every book route sits behind this. There is no login screen on this
 * surface — pairing (§Autentificare) is the only way a device gets a
 * session — so "no cookie" and "go pair" are the same instruction here that
 * they are at `/` (`server.ts`).
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (sessionCookieFrom(req) === undefined) {
    res.redirect(303, "/pair");
    return;
  }

  next();
}
