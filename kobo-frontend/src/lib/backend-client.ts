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

async function call<T>(
  url: string,
  init?: RequestInit,
  sessionCookie?: string,
): Promise<T> {
  // Left as `init` verbatim — including `undefined` — for the unauthenticated
  // pairing calls, so a plain `fetch(url)` is what actually goes out rather
  // than `fetch(url, {})`, which is equivalent but not identical.
  const requestInit: RequestInit | undefined =
    sessionCookie === undefined
      ? init
      : {
          ...init,
          headers: {
            ...(init?.headers as Record<string, string> | undefined),
            Cookie: `${SESSION_COOKIE}=${sessionCookie}`,
          },
        };

  let res: Response;

  try {
    res = await fetch(url, requestInit);
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

export function createPairing(env: Env): Promise<CreatePairingResponse> {
  return call(`${env.API_URL}/pairing`, { method: "POST" });
}

export function pairingStatus(env: Env, id: string): Promise<PairingStatusResponse> {
  return call(`${env.API_URL}/pairing/${encodeURIComponent(id)}`);
}

export function consumePairing(env: Env, id: string): Promise<ConsumePairingResponse> {
  return call(`${env.API_URL}/pairing/${encodeURIComponent(id)}/consume`, {
    method: "POST",
  });
}

// --- Books CRUD — authenticated, on the reader's behalf. -------------------

export function listBooks(env: Env, sessionCookie: string): Promise<Book[]> {
  return call(`${env.API_URL}/books`, {}, sessionCookie);
}

export function getBook(env: Env, sessionCookie: string, id: string): Promise<Book> {
  return call(`${env.API_URL}/books/${encodeURIComponent(id)}`, {}, sessionCookie);
}

export function createBook(
  env: Env,
  sessionCookie: string,
  payload: Record<string, unknown>,
): Promise<Book> {
  return call(`${env.API_URL}/books`, jsonInit("POST", payload), sessionCookie);
}

export function updateBook(
  env: Env,
  sessionCookie: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<Book> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}`,
    jsonInit("PATCH", payload),
    sessionCookie,
  );
}

export function deleteBook(env: Env, sessionCookie: string, id: string): Promise<void> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    sessionCookie,
  );
}

export function purchaseBook(env: Env, sessionCookie: string, id: string): Promise<Book> {
  return call(
    `${env.API_URL}/books/${encodeURIComponent(id)}/purchase`,
    { method: "POST" },
    sessionCookie,
  );
}

// --- Dashboard figures (S8.1) — the same two endpoints the React dashboard reads. ---

export function getStatsOverview(env: Env, sessionCookie: string): Promise<StatsOverview> {
  return call(`${env.API_URL}/stats/overview`, {}, sessionCookie);
}

export function getBudgetSummary(env: Env, sessionCookie: string): Promise<BudgetSummary> {
  return call(`${env.API_URL}/budget/summary`, {}, sessionCookie);
}
