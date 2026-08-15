import { describe, expect, it } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { isFiltered } from "./filters";

const BASE: ListBooksQuery = { sort: "createdAt", order: "desc" };

describe("isFiltered", () => {
  it("is false for a bare query", () => {
    expect(isFiltered(BASE)).toBe(false);
  });

  it("is false for an empty status list, which filters nothing", () => {
    expect(isFiltered({ ...BASE, status: [] })).toBe(false);
  });

  it.each<[string, Partial<ListBooksQuery>]>([
    ["status", { status: ["READING"] }],
    ["genre", { genre: "FICTION" }],
    ["favorite", { favorite: true }],
  ])("is true with %s set", (_name, filter) => {
    expect(isFiltered({ ...BASE, ...filter })).toBe(true);
  });
});
