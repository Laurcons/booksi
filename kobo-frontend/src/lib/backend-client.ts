import type {
  Book,
  BudgetSummary,
  ConsumePairingResponse,
  CreatePairingResponse,
  PairingStatusResponse,
  StatsOverview,
} from "@bookcsi/shared";
import { SESSION_COOKIE } from "./session-cookie";
import type { Env } from "../config/env";

/**
 * The one place this workspace calls the Nest API from its own process. Two
 * shapes of call live here side by side:
 *
 * - **Unauthenticated, server-to-server** (`createPairing`, `pairingStatus`,
 *   `consumePairing`) — pairing has no session yet to carry.
 * - **Authenticated, on the reader's behalf** (everything book-related) —
 *   `.env.example`'s own description of the arrangement: "requests go server
 *   to server with the reader's session cookie forwarded along". The cookie
 *   is read out of the incoming request by the route and passed in here
 *   explicitly, never read from this module's own environment — there is no
 *   ambient session, only the one a given request happened to carry.
 */
export class BackendError extends Error {}

/** The session forwarded is missing or no longer valid — the route's cue to send the reader back to `/pair`. */
export class BackendUnauthorizedError extends BackendError {}

/** Any other non-2xx: `messages` is `HttpErrorBody.message`, always as an array, ready for `groupErrorsByField`. */
export class BackendRequestError extends BackendError {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(`API answered ${status}: ${messages.join("; ")}`);
  }
}

/**
 * Every call through here is on a Kobo reader's behalf — `X-Client: kobo` is
 * how the API tells this apart from the React app for its audit trail
 * without depending on any particular device's User-Agent string surviving
 * unchanged. The device's real User-Agent is forwarded alongside it anyway
 * (`userAgent`, read off the incoming request by the route, the same way the
 * session cookie already is) — the header is the reliable signal, the UA is
 * the forensic detail.
 */
async function call<T>(
  url: string,
  init: RequestInit | undefined,
  sessionCookie: string | undefined,
  userAgent: string | undefined,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    "X-Client": "kobo",
  };
  if (userAgent !== undefined) {
    headers["User-Agent"] = userAgent;
  }
  if (sessionCookie !== undefined) {
    headers["Cookie"] = `${SESSION_COOKIE}=${sessionCookie}`;
  }

  let res: Response;

  try {
    res = await fetch(url, { ...init, headers });
  } catch (error) {
    throw new BackendError(`could not reach the API: ${String(error)}`);
  }

  if (res.status === 401) {
    throw new BackendUnauthorizedError(`session rejected for ${url}`);
  }

  if (!res.ok) {
    throw new BackendRequestError(res.status, await errorMessages(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

async function errorMessages(res: Response): Promise<string[]> {
  try {
    const body = (await res.json()) as { message?: unknown };

    if (Array.isArray(body.message)) {
      return body.message as string[];
    }
    if (typeof body.message === "string") {
      return [body.message];
    }
  } catch {
    // Not JSON at all — a proxy's error page, a gateway timeout.
  }

  return [`API-ul a răspuns cu eroarea ${res.status}.`];
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

// --- Pairing (§Autentificare) — unauthenticated, server-to-server. ---------

export function createPairing(env: Env, userAgent: string | undefined): Promise<CreatePairingResponse> {
  return call(`${env.API_URL}/pairing`, { method: "POST" }, undefined, userAgent);
}

export function pairingStatus(
  env: Env,
  userAgent: string | undefined,
  id: string,
): Promise<PairingStatusResponse> {
  return call(`${env.API_URL}/pairing/${encodeURIComponent(id)}`, undefined, undefined, userAgent);
}

export function consumePairing(
  env: Env,
  userAgent: string | undefined,
  id: string,
): Promise<ConsumePairingResponse> {
  return call(
    `${env.API_URL}/pairing/${encodeURIComponent(id)}/consume`,
    { method: "POST" },
    undefined,
    userAgent,
  );
}

// --- Books CRUD — authenticated, on the reader's behalf. -------------------

export function listBooks(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
): Promise<Book[]> {
  return call(`${env.API_URL}/books`, {}, sessionCookie, userAgent);
}

export function getBook(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  id: string,
): Promise<Book> {
  return call(`${env.API_URL}/books/${encodeURIComponent(id)}`, {}, sessionCookie, userAgent);
}

export function createBook(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  payload: Record<string, unknown>,
): Promise<Book> {
  return call(`${env.API_URL}/books`, jsonInit("POST", payload), sessionCookie, userAgent);
}

export function updateBook(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Book> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}`,
    jsonInit("PATCH", payload),
    sessionCookie,
    userAgent,
  );
}

export function deleteBook(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  id: string,
): Promise<void> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    sessionCookie,
    userAgent,
  );
}

export function purchaseBook(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  id: string,
): Promise<Book> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}/purchase`,
    { method: "POST" },
    sessionCookie,
    userAgent,
  );
}

// --- Dashboard figures (S8.1) — the same two endpoints the React dashboard reads. ---

export function getStatsOverview(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
): Promise<StatsOverview> {
  return call(`${env.API_URL}/stats/overview`, {}, sessionCookie, userAgent);
}

export function getBudgetSummary(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
): Promise<BudgetSummary> {
  return call(`${env.API_URL}/budget/summary`, {}, sessionCookie, userAgent);
}

// --- Cover image — binary, so it bypasses `call()`, which assumes JSON. ----

export interface CoverImage {
  status: number;
  contentType: string | null;
  cacheControl: string | null;
  etag: string | null;
  body: Buffer;
}

export async function getCoverImage(
  env: Env,
  userAgent: string | undefined,
  sessionCookie: string,
  bookId: string,
): Promise<CoverImage> {
  const headers: Record<string, string> = {
    Cookie: `${SESSION_COOKIE}=${sessionCookie}`,
    "X-Client": "kobo",
  };
  if (userAgent !== undefined) {
    headers["User-Agent"] = userAgent;
  }

  let res: Response;

  try {
    res = await fetch(`${env.API_URL}/covers/${encodeURIComponent(bookId)}`, { headers });
  } catch (error) {
    throw new BackendError(`could not reach the API: ${String(error)}`);
  }

  if (res.status === 401) {
    throw new BackendUnauthorizedError(`session rejected for covers/${bookId}`);
  }

  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    cacheControl: res.headers.get("cache-control"),
    etag: res.headers.get("etag"),
    body: Buffer.from(await res.arrayBuffer()),
  };
}
