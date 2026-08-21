import { describe, expect, it } from "vitest";
import { createBookSchema } from "@bookcsi/shared";
import {
  DESCRIPTION_MAX,
  EMPTY,
  FORM_FIELDS,
  REVIEW_MAX,
  TAB_OF_FIELD,
  ratingFor,
  tabsOf,
  toFormValues,
} from "./schema";
import { makeBook } from "../../../test/helpers";

describe("the form's field map", () => {
  it("puts every field on a tab", () => {
    // The map drives the dots on the tab strip, so a field missing from it is a
    // field whose unsaved change or validation error is invisible.
    for (const field of FORM_FIELDS) {
      expect(TAB_OF_FIELD[field], field).toBeDefined();
    }
  });

  it("names the tabs holding the given fields, in tab order", () => {
    expect(tabsOf(["review", "title"])).toEqual(["book", "verdict"]);
    expect(tabsOf(["paidPrice", "status"])).toEqual(["reading"]);
    expect(tabsOf([])).toEqual([]);
  });

  it("ignores keys that are not fields", () => {
    // `Object.keys(dirtyFields)` is not guaranteed to contain only field names.
    expect(tabsOf(["root", "somethingElse"])).toEqual([]);
  });
});

describe("the rating gate", () => {
  it("sends the number on a status that can hold one", () => {
    expect(ratingFor("FINISHED", "4")).toBe(4);
    expect(ratingFor("ABANDONED", "2")).toBe(2);
  });

  it("sends null when the rating was cleared", () => {
    expect(ratingFor("FINISHED", "")).toBeNull();
  });

  it("sends nothing at all on a status that cannot", () => {
    // `undefined`, not `null`: absent leaves the stored rating alone, which is
    // what the API does on a re-read. `null` would wipe it from the outside.
    expect(ratingFor("READING", "5")).toBeUndefined();
    expect(ratingFor("WISHLIST", "")).toBeUndefined();
  });
});

describe("the review field", () => {
  it("starts empty and round-trips a stored review", () => {
    expect(EMPTY.review).toBe("");
    expect(toFormValues(makeBook({ review: "A doua citire." })).review).toBe(
      "A doua citire.",
    );
    expect(toFormValues(makeBook({ review: null })).review).toBe("");
  });

  it("reports the same caps the API enforces", () => {
    // The counter under each textarea quotes these numbers, so they have to be
    // the schema's rather than a second opinion about them.
    const tooLong = (field: "description" | "review", max: number) =>
      createBookSchema.safeParse({ title: "Dune", [field]: "x".repeat(max + 1) }).success;

    expect(createBookSchema.safeParse({ title: "Dune", description: "x".repeat(DESCRIPTION_MAX) }).success).toBe(true);
    expect(tooLong("description", DESCRIPTION_MAX)).toBe(false);

    expect(createBookSchema.safeParse({ title: "Dune", review: "x".repeat(REVIEW_MAX) }).success).toBe(true);
    expect(tooLong("review", REVIEW_MAX)).toBe(false);
  });
});
