import { describe, expect, it } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { isFiltered, isSearched } from "./filters";

const BASE: ListBooksQuery = { sort: "createdAt", order: "desc" };

describe("isFiltered", () => {
  it("is false for a bare query", () => {
    expect(isFiltered(BASE)).toBe(false);
  });

  it("is false for an empty status list, which filters nothing", () => {
    expect(isFiltered({ ...BASE, status: [] })).toBe(false);
  });

  it("is false for an empty search, which narrows nothing", () => {
    expect(isFiltered({ ...BASE, q: "" })).toBe(false);
  });

  it.each<[string, Partial<ListBooksQuery>]>([
    ["status", { status: ["READING"] }],
    ["genre", { genre: "FICTION" }],
    ["favorite", { favorite: true }],
    // §D42 — a search narrows the list like a filter, so the empty state has
    // to read the same way rather than claiming the library is empty.
    ["q", { q: "dune" }],
  ])("is true with %s set", (_name, filter) => {
    expect(isFiltered({ ...BASE, ...filter })).toBe(true);
  });
});

describe("isSearched (§D42)", () => {
  it("is true only for a search", () => {
    expect(isSearched({ ...BASE, q: "dune" })).toBe(true);
  });

  it("ignores the filters", () => {
    // The wishlist's total is global, and the line admitting that is about the
    // search alone — a status filter must not summon it.
    expect(isSearched({ ...BASE, status: ["WISHLIST"], favorite: true })).toBe(
      false,
    );
  });

  it("is false for an empty or absent search", () => {
    expect(isSearched({ ...BASE, q: "" })).toBe(false);
    expect(isSearched(BASE)).toBe(false);
  });
});
