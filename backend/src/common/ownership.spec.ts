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
    // Nest's bare `NotFoundException` produces the English words "Not Found",
    // which the client passes straight through to somebody who followed a
    // stale link. An error the user can act on gets a sentence.
    expect(() => ownedOrNotFound(null)).toThrow(/nu există sau nu e a ta/);
  });

  it("treats undefined the same as null", () => {
    expect(() => ownedOrNotFound(undefined)).toThrow(AppError);
  });
});
