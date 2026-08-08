import { describe, expect, it } from "vitest";
import { makeBook } from "../test/fixtures";
import {
  buildBookPayload,
  buildUpdatePayload,
  EMPTY_FORM_VALUES,
  groupErrorsByField,
  readFormValues,
  valuesFromBook,
} from "./book-form-fields";

describe("readFormValues", () => {
  it("defaults every field to an empty string when the body has nothing", () => {
    // Unlike `EMPTY_FORM_VALUES` (a blank *add* form's starting point, which
    // defaults `status` to WISHLIST for the `<select>`), this reads a real
    // submission verbatim — an actually-empty `status` here is a submission
    // to investigate, not a default to paper over.
    expect(readFormValues(undefined)).toEqual({ ...EMPTY_FORM_VALUES, status: "" });
  });

  it("ignores anything that is not a string, rather than crash on it", () => {
    const values = readFormValues({ title: ["not", "a", "string"], author: "Cineva" });

    expect(values.title).toBe("");
    expect(values.author).toBe("Cineva");
  });
});

describe("valuesFromBook", () => {
  it("round-trips a book's fields into form strings", () => {
    const book = makeBook({ totalPages: 620, rating: 4, estimatedPrice: 42.5 });

    const values = valuesFromBook(book);

    expect(values.totalPages).toBe("620");
    expect(values.rating).toBe("4");
    expect(values.estimatedPrice).toBe("42.5");
    expect(values.status).toBe("READING");
  });

  it("renders a null field as an empty string, not the word null", () => {
    const book = makeBook({ author: null, rating: null, finishedOn: null });

    const values = valuesFromBook(book);

    expect(values.author).toBe("");
    expect(values.rating).toBe("");
    expect(values.finishedOn).toBe("");
  });
});

describe("buildBookPayload", () => {
  it("requires nothing but the title to produce a valid-shaped payload", () => {
    const payload = buildBookPayload({ ...EMPTY_FORM_VALUES, title: "Dune" });

    expect(payload.title).toBe("Dune");
    expect(payload.author).toBeNull();
    expect(payload.totalPages).toBeNull();
  });

  it("clears pagesRead to 0 rather than null, since the column is not nullable", () => {
    const payload = buildBookPayload({ ...EMPTY_FORM_VALUES, title: "Dune", pagesRead: "" });

    expect(payload.pagesRead).toBe(0);
  });

  it("coerces numeric text to real numbers", () => {
    const payload = buildBookPayload({
      ...EMPTY_FORM_VALUES,
      title: "Dune",
      totalPages: "620",
      rating: "4",
      estimatedPrice: "42.50",
    });

    expect(payload.totalPages).toBe(620);
    expect(payload.rating).toBe(4);
    expect(payload.estimatedPrice).toBe(42.5);
  });

  it("passes non-numeric text through unchanged, so the API rejects it with its own message", () => {
    const payload = buildBookPayload({ ...EMPTY_FORM_VALUES, title: "Dune", totalPages: "multe" });

    // Not null, and not NaN (which would silently become null over JSON) —
    // exactly what was typed, for `createBookSchema` to refuse by name.
    expect(payload.totalPages).toBe("multe");
  });

  it("normalizes a day-first date before sending it", () => {
    const payload = buildBookPayload({
      ...EMPTY_FORM_VALUES,
      title: "Dune",
      purchasedOn: "6.8.2026",
    });

    expect(payload.purchasedOn).toBe("2026-08-06");
  });

  it("omits status when the field is somehow empty, rather than send an invalid one", () => {
    const payload = buildBookPayload({ ...EMPTY_FORM_VALUES, title: "Dune", status: "" });

    expect("status" in payload).toBe(false);
  });
});

describe("buildUpdatePayload", () => {
  it("sends nothing when the form was submitted unchanged", () => {
    const book = makeBook();
    const payload = buildUpdatePayload(valuesFromBook(book), book);

    expect(payload).toEqual({});
  });

  it("sends only the one field that actually changed", () => {
    const book = makeBook({ pagesRead: 143 });
    const values = { ...valuesFromBook(book), pagesRead: "200" };

    const payload = buildUpdatePayload(values, book);

    expect(payload).toEqual({ pagesRead: 200 });
  });

  it("does not resend an untouched, already-empty date as an explicit null", () => {
    // The exact failure mode this exists to prevent: a status change to
    // `Citesc` must not silently cancel S1.5's auto-stamp of `startedOn`.
    const book = makeBook({ status: "PURCHASED", startedOn: null });
    const values = { ...valuesFromBook(book), status: "READING" };

    const payload = buildUpdatePayload(values, book);

    expect(payload).toEqual({ status: "READING" });
    expect("startedOn" in payload).toBe(false);
  });

  it("does send an explicit clear when a previously-set field is emptied", () => {
    const book = makeBook({ rating: 4 });
    const values = { ...valuesFromBook(book), rating: "" };

    const payload = buildUpdatePayload(values, book);

    expect(payload).toEqual({ rating: null });
  });
});

describe("groupErrorsByField", () => {
  it("groups a field-prefixed message under its field", () => {
    const grouped = groupErrorsByField(["title: Titlul e obligatoriu"]);

    expect(grouped["title"]).toEqual(["Titlul e obligatoriu"]);
  });

  it("files a message with no recognisable field under the empty key", () => {
    const grouped = groupErrorsByField(["Ceva nu e valid"]);

    expect(grouped[""]).toEqual(["Ceva nu e valid"]);
  });

  it("keeps several messages for the same field together, in order", () => {
    const grouped = groupErrorsByField([
      "rating: Ratingul e în stele întregi",
      "rating: Ratingul e între 1 și 5 stele",
    ]);

    expect(grouped["rating"]).toEqual([
      "Ratingul e în stele întregi",
      "Ratingul e între 1 și 5 stele",
    ]);
  });
});
