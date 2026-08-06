import { NotFoundException } from "@nestjs/common";
import { ownedOrNotFound } from "./ownership";

describe("ownedOrNotFound", () => {
  it("returns the row when it belongs to the caller", () => {
    const row = { id: "book-1", userId: "user-1" };
    expect(ownedOrNotFound(row)).toBe(row);
  });

  it("raises 404, not 403, when the query found nothing (S0.3)", () => {
    // A `where: { id, userId }` miss is indistinguishable from a non-existent
    // id on purpose — 403 would confirm the book exists elsewhere.
    expect(() => ownedOrNotFound(null)).toThrow(NotFoundException);
    expect(() => ownedOrNotFound(null)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it("treats undefined the same as null", () => {
    expect(() => ownedOrNotFound(undefined)).toThrow(NotFoundException);
  });
});
