import { describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, errorMessage, UnauthorizedError } from "./api";

/**
 * §D27's client half.
 *
 * What reaches the screen is decided in two places now, and the split is the
 * point: `apiFetch` carries the server's `code` across without judging it, and
 * `errorMessage` decides — once — whether there are words worth showing. The
 * rule it applies is "is there a code", never "is the status under 500", and
 * the tests below are mostly about that distinction, because the status-based
 * version looks right until an upstream outage arrives.
 */
function respond(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: "",
        json: () => Promise.resolve(body),
      }),
    ),
  );
}

/** The rejection, typed — every test here is about what it carries. */
const failure = async (): Promise<ApiError> =>
  (await apiFetch("/books").catch((e: unknown) => e)) as ApiError;

describe("apiFetch", () => {
  it("quotes a validation failure, which is written for the user", async () => {
    respond(400, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: ["title: Titlul e obligatoriu"],
    });

    await expect(apiFetch("/books")).rejects.toThrow("title: Titlul e obligatoriu");
  });

  it("joins several validation messages into one line", async () => {
    respond(400, {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: ["title: obligatoriu", "genre: invalid"],
    });

    await expect(apiFetch("/books")).rejects.toThrow(
      "title: obligatoriu, genre: invalid",
    );
  });

  it("carries the code across so a caller can branch on it", async () => {
    respond(404, {
      statusCode: 404,
      code: "OPEN_LIBRARY_NOT_FOUND",
      message: "Open Library nu cunoaște cartea asta.",
    });

    const error = await failure();

    expect(error.code).toBe("OPEN_LIBRARY_NOT_FOUND");
  });

  it("ignores a code it does not recognise", async () => {
    // This is the network talking. An unknown string must not be promoted into
    // "the server says this is showable".
    respond(400, { statusCode: 400, code: "SOMETHING_NEW", message: "ceva" });

    expect((await failure()).code).toBeUndefined();
  });

  it("leaves the code absent when the body has none", async () => {
    respond(500, { statusCode: 500, message: "Ceva n-a mers bine pe server." });

    expect((await failure()).code).toBeUndefined();
  });

  /** A 401 is a routing decision, and `query-client` keys off the type. */
  it("keeps 401 distinguishable on sight", async () => {
    respond(401, { statusCode: 401, code: "UNAUTHENTICATED", message: "..." });

    await expect(apiFetch("/books")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("errorMessage", () => {
  it("shows a coded message whatever the status", async () => {
    // The case the old status-based rule got wrong. An upstream outage is a
    // 5xx — not the client's fault — and entirely actionable.
    respond(503, {
      statusCode: 503,
      code: "OPEN_LIBRARY_UNAVAILABLE",
      message: "Open Library nu răspunde acum. Poți completa cartea manual.",
    });

    const error = await failure();

    expect(errorMessage(error, "fallback")).toMatch(/Poți completa cartea manual/);
  });

  it("substitutes for an uncoded failure, whatever it said", async () => {
    // A generic 500 has nothing addressed to anybody in it. Neither would a
    // driver error that slipped through, which is the reason this is a
    // whitelist rather than a blacklist.
    respond(500, {
      statusCode: 500,
      message: "Cannot read properties of undefined (reading 'estimatedPrice')",
    });

    const error = await failure();

    expect(errorMessage(error, "fallback")).toBe("fallback");
  });

  it("substitutes for something that never reached the API", async () => {
    // A network error is not an `ApiError` at all.
    expect(errorMessage(new TypeError("Failed to fetch"), "fallback")).toBe(
      "fallback",
    );
  });

  it("explains a rate limit as waiting, because waiting is actionable", async () => {
    // The message is the server's now — the filter gives `ThrottlerException`
    // a code on its way out, so the client no longer special-cases 429.
    respond(429, {
      statusCode: 429,
      code: "RATE_LIMITED",
      message: "Prea multe cereri într-un timp scurt. Așteaptă un moment.",
    });

    const error = await failure();

    expect(errorMessage(error, "fallback")).toMatch(/Așteaptă/);
  });
});
