import { DEFAULT_LOCALE, errorMessageFor } from "@bookcsi/shared";
import { AppError } from "./app-error";
import { ownedOrNotFound } from "./ownership";

describe("ownedOrNotFound", () => {
  it("returns the row when it belongs to the caller", () => {
    const row = { id: "book-1", userId: "user-1" };
    expect(ownedOrNotFound(row)).toBe(row);
  });

  it("raises 404, not 403, when the query found nothing (S0.3)", () => {
    // A `where: { id, userId }` miss is indistinguishable from a non-existent
    // id on purpose — 403 would confirm the book exists elsewhere.
    expect(() => ownedOrNotFound(null)).toThrow(AppError);
    expect(() => ownedOrNotFound(null)).toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("says something a person can read (§D27)", () => {
    // Nest's bare `NotFoundException` produces the words "Not Found", which the
    // client passes straight through to somebody who followed a stale link. An
    // error the user can act on gets a sentence.
    //
    // Asserted through the catalog rather than against a literal, because §D44
    // moved the choice of *which* sentence to the filter: what a throw commits
    // to is the key, and an `AppError` built without a reader words itself in
    // `DEFAULT_LOCALE`.
    expect(() => ownedOrNotFound(null)).toThrow(
      errorMessageFor(DEFAULT_LOCALE, "error.book.notFound"),
    );
  });

  it("names the failure by key, so the filter can word it for either reader", () => {
    const thrown = (() => {
      try {
        ownedOrNotFound(null);
      } catch (error) {
        return error as AppError;
      }
      throw new Error("expected a throw");
    })();

    expect(thrown.key).toBe("error.book.notFound");
    expect(thrown.messageFor("ro")).toMatch(/nu există sau nu e a ta/);
    expect(thrown.messageFor("en")).toMatch(/does not exist, or is not yours/);
  });

  it("treats undefined the same as null", () => {
    expect(() => ownedOrNotFound(undefined)).toThrow(AppError);
  });
});
