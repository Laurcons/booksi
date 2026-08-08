import type {
  ConsumePairingResponse,
  CreatePairingResponse,
  PairingStatusResponse,
} from "@bookcsi/shared";
import type { Env } from "../config/env";

/**
 * The one place this workspace calls the Nest API from its own process
 * rather than through a reader's browser — pairing has no session yet to
 * carry, so there is nothing for a browser-mediated request to forward
 * (contrast the rest of the API, reached "server to server with the reader's
 * session cookie forwarded", per `.env.example`). `API_URL` is internal, not
 * the public hostname (§D37) — nothing here is subject to CORS or
 * `WEB_ORIGIN`.
 */
export class BackendError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, init);
  } catch (error) {
    throw new BackendError(`could not reach the API: ${String(error)}`);
  }

  if (!res.ok) {
    throw new BackendError(`API answered ${res.status} for ${url}`);
  }

  return (await res.json()) as T;
}

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
