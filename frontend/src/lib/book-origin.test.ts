import { describe, expect, it } from "vitest";
import { makeBook } from "../test/helpers";
import { bookProfilePath, defaultOrigin, readOrigin } from "./book-origin";

/**
 * §D41 — the parsing half of the back button, tested away from the router.
 *
 * These are the cases a rendered test cannot reach comfortably: history state
 * outlives the code that wrote it and is editable from the console, so what
 * matters is what happens when it comes back wrong rather than when it comes
 * back at all.
 */
describe("readOrigin", () => {
  it("reads back what useOpenBook wrote", () => {
    expect(readOrigin({ origin: { to: "/gallery", label: "origin.gallery" } })).toEqual({
      to: "/gallery",
      label: "origin.gallery",
    });
  });

  it("keeps the query string, since a filtered listing is a place too", () => {
    const state = { origin: { to: "/wishlist?sort=title", label: "origin.wishlist" } };

    expect(readOrigin(state)?.to).toBe("/wishlist?sort=title");
  });

  it("ignores a cold arrival, which has no state at all", () => {
    expect(readOrigin(null)).toBeNull();
    expect(readOrigin(undefined)).toBeNull();
    expect(readOrigin({})).toBeNull();
  });

  it("ignores state left by something other than this app", () => {
    expect(readOrigin({ origin: "wherever" })).toBeNull();
    expect(readOrigin({ origin: { to: "/gallery" } })).toBeNull();
    expect(readOrigin({ origin: { to: 7, label: "origin.gallery" } })).toBeNull();
    expect(readOrigin({ origin: { to: "/gallery", label: "" } })).toBeNull();
    // §D44 — the label is a catalog key now, so a label that is merely a
    // non-empty string is not enough: an unknown one would render as itself.
    expect(
      readOrigin({ origin: { to: "/gallery", label: "galerie" } }),
    ).toBeNull();
  });

  /**
   * The reason this is parsed rather than cast. History state is writable, and
   * a button labelled "înapoi" that navigates off-origin is an open redirect
   * with a friendly word on it — the same rule `return-to.ts` applies to the
   * path it stores for the login round trip.
   */
  it("refuses to send the user off the site", () => {
    expect(readOrigin({ origin: { to: "https://evil.example", label: "origin.gallery" } })).toBeNull();
    expect(readOrigin({ origin: { to: "//evil.example", label: "origin.gallery" } })).toBeNull();
    expect(readOrigin({ origin: { to: "javascript:alert(1)", label: "origin.gallery" } })).toBeNull();
  });
});

describe("defaultOrigin", () => {
  it("sends a wishlist book back to the wishlist", () => {
    expect(defaultOrigin(makeBook({ status: "WISHLIST" }))).toEqual({
      to: "/wishlist",
      label: "origin.wishlist",
    });
  });

  it("sends everything else to the library", () => {
    for (const status of ["PURCHASED", "READING", "FINISHED", "ABANDONED"] as const) {
      expect(defaultOrigin(makeBook({ status })).to).toBe("/");
    }
  });

  it("answers for a book that has not loaded yet", () => {
    // The profile renders its back button before the request comes back, so
    // this is a real state rather than a defensive branch.
    expect(defaultOrigin(undefined)).toEqual({ to: "/", label: "origin.library" });
  });
});

describe("bookProfilePath", () => {
  it("addresses a book by id", () => {
    expect(bookProfilePath("book-1")).toBe("/books/book-1");
  });
});
