import type { Request } from "express";

/**
 * Header values worth seeing, shared between `/probe` (renders them) and
 * `/probe/report` (records them again on the submission request). Not the
 * same request — the report is its own POST — so the report captures its own
 * copy rather than trusting whatever the page had rendered earlier.
 *
 * `cookie` is deliberately absent: the session JWT rides in that header, and
 * anything that echoes it becomes a diagnostic surface that leaks a 30-day
 * token onto an e-reader screen, or into a screenshot of one.
 */
export const INTERESTING_HEADERS = [
  "user-agent",
  "accept",
  "accept-encoding",
  "accept-language",
  "host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "referer",
] as const;

export function headerValue(req: Request, name: string): string {
  const value = req.headers[name];

  if (value === undefined) {
    return "— absent —";
  }

  return Array.isArray(value) ? value.join(", ") : value;
}

export function captureHeaderFacts(req: Request): Record<string, string> {
  const out: Record<string, string> = {};

  for (const name of INTERESTING_HEADERS) {
    out[name] = headerValue(req, name);
  }

  return out;
}
