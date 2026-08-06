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

/**
 * Every call site puts this straight on screen, so what it returns has to be
 * addressed to the user rather than to whoever reads the logs.
 *
 * A 4xx is the client's own request being refused, and the API answers those in
 * sentences written for exactly this purpose — "title: Titlul e obligatoriu" is
 * worth showing verbatim. A 5xx is not: its message is a stack frame, a driver
 * error, a column name. Unhelpful to the reader at best, and at worst a
 * description of the inside of the server on somebody's screen.
 */
async function readErrorMessage(res: Response): Promise<string> {
  if (res.status >= 500) {
    return "Ceva n-a mers bine pe server. Încearcă din nou peste puțin.";
  }

  if (res.status === 429) {
    return "Prea multe cereri într-un timp scurt. Așteaptă un moment.";
  }

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
