/**
 * Where the user was when the session ran out (S0.2).
 *
 * `sessionStorage` rather than router state: the way back from Google is a
 * full page load, which wipes anything held in memory or in the history entry.
 * It is scoped to the tab and dies with it, which is the right lifetime — a
 * return path from last week is noise.
 */
const KEY = "bookcsi:returnTo";

export function rememberReturnTo(path: string): void {
  if (path === "/" || path.startsWith("/login")) {
    return;
  }
  sessionStorage.setItem(KEY, path);
}

/** Reads and clears in one go, so a stored path is only ever used once. */
export function takeReturnTo(): string | null {
  const path = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  // Only in-app paths: an absolute URL here would be an open redirect.
  return path?.startsWith("/") && !path.startsWith("//") ? path : null;
}
