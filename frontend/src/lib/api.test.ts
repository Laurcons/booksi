import { describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, UnauthorizedError } from "./api";

/**
 * What `apiFetch` puts in an `ApiError`'s message goes straight onto the
 * screen — `BookFormDialog`, `LoadFailure` and `RequireAuth` all render it —
 * so which errors are quoted and which are paraphrased is a product decision,
 * not an implementation detail.
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

describe("apiFetch error messages", () => {
  it("quotes a validation failure, which is written for the user", async () => {
    respond(400, { statusCode: 400, message: ["title: Titlul e obligatoriu"] });

    await expect(apiFetch("/books")).rejects.toThrow("title: Titlul e obligatoriu");
  });

  it("joins several validation messages into one line", async () => {
    respond(400, {
      statusCode: 400,
      message: ["title: obligatoriu", "genre: invalid"],
    });

    await expect(apiFetch("/books")).rejects.toThrow(
      "title: obligatoriu, genre: invalid",
    );
  });

  /**
   * The server's own words here are a stack frame or a driver error. They tell
   * the reader nothing and describe the inside of the server, so they are
   * replaced rather than shown.
   */
  it("does not put a server-side failure's text on screen", async () => {
    respond(500, {
      statusCode: 500,
      message: "Cannot read properties of undefined (reading 'estimatedPrice')",
    });

    const error = await apiFetch("/books").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).not.toContain("undefined");
    expect((error as ApiError).message).toContain("server");
  });

  it("explains a rate limit as waiting rather than as a failure", async () => {
    respond(429, { statusCode: 429, message: "ThrottlerException: Too Many Requests" });

    await expect(apiFetch("/books")).rejects.toThrow(/Așteaptă/);
  });

  /** A 401 is a routing decision, and `query-client` keys off the type. */
  it("keeps 401 distinguishable on sight", async () => {
    respond(401, { statusCode: 401, message: "Unauthorized" });

    await expect(apiFetch("/books")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
