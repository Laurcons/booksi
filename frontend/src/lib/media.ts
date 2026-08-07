import { API_URL } from "./api";

/**
 * An image path from the API turned into something an `<img>` can load.
 *
 * The API returns paths, not absolute URLs — `/covers/abc?v=123` — because the
 * origin is the client's business and differs between development (`:3000`)
 * and anything deployed. Assembling it here means the rule lives in one place
 * rather than in every component that draws a cover.
 *
 * **Every one of these routes needs the session cookie**, which is why the
 * companion below exists: an `<img>` does not send credentials cross-origin
 * unless it is told to, and in development the API *is* a different origin. A
 * cover would come back 401 and render as a broken image, on a page where
 * every `fetch` works — which is a confusing enough hour that it is worth a
 * named export.
 */
export function apiImageSrc(path: string | null | undefined): string | null {
  return path === null || path === undefined ? null : `${API_URL}${path}`;
}

/**
 * Spread onto any `<img>` pointed at `apiImageSrc`.
 *
 * `use-credentials` makes the browser send the session cookie and, in
 * exchange, requires the response to name this exact origin in
 * `Access-Control-Allow-Origin` — which the API does (§D20 rules out a
 * wildcard for precisely this reason, since credentialed CORS forbids one).
 */
export const CREDENTIALED_IMAGE = { crossOrigin: "use-credentials" } as const;
