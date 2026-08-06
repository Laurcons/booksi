/**
 * The session lives in an httpOnly cookie (§D20), so every request has to opt
 * into sending credentials — cross-origin fetch drops cookies by default, and
 * in dev the API is a different origin (:3000 vs :5173).
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Distinguishable on sight, because a 401 is a routing decision, not a bug. */
export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, "Sesiune expirată sau inexistentă");
    this.name = "UnauthorizedError";
  }
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
    throw new ApiError(res.status, await readErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    return message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}
