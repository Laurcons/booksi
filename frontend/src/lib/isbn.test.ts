import { describe, expect, it } from "vitest";
import { isScannedIsbn, isValidIsbn13 } from "@bookcsi/shared";

/**
 * §D43 — the two guards standing between a camera and the ISBN field.
 *
 * Tested from here rather than from `shared/`, which has no runner of its own
 * (see `progress.test.ts`, same arrangement). The scanner is the only caller.
 */
describe("isValidIsbn13 (§D43)", () => {
  it("accepts a real ISBN-13, punctuated or not", () => {
    expect(isValidIsbn13("978-0-441-01359-3")).toBe(true);
    expect(isValidIsbn13("9780441013593")).toBe(true);
  });

  it("accepts the 979 prefix", () => {
    // 979 is Bookland too, and increasingly common — a validator that only knew
    // 978 would reject newer books outright.
    expect(isValidIsbn13("9790000000001")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    // The whole point: one digit off is what a misread barcode looks like.
    expect(isValidIsbn13("978-0-441-01359-4")).toBe(false);
  });

  it("rejects a transposition, which a length check would not catch", () => {
    expect(isValidIsbn13("9780441013953")).toBe(false);
  });

  it("rejects anything that is not thirteen digits", () => {
    expect(isValidIsbn13("0441013590")).toBe(false); // ISBN-10
    expect(isValidIsbn13("54495")).toBe(false); // EAN-5 price add-on
    expect(isValidIsbn13("")).toBe(false);
  });

  it("rejects an ISBN-10's X check digit rather than counting it as a digit", () => {
    // `normalizeIsbn` keeps X on purpose (§D13), so this has to be excluded
    // here instead — thirteen characters is not thirteen digits.
    expect(isValidIsbn13("978044101359X")).toBe(false);
  });
});

describe("isScannedIsbn (§D43)", () => {
  it("accepts a book's barcode", () => {
    expect(isScannedIsbn("9780441013593")).toBe(true);
  });

  it("rejects an ISSN, even though its checksum is perfectly valid", () => {
    // The case that makes the prefix check earn its place: a magazine's
    // barcode is a well-formed EAN-13 starting 977, and a checksum-only guard
    // would hand it to the lookup as if it were a book.
    expect(isValidIsbn13("9771234567003")).toBe(true);
    expect(isScannedIsbn("9771234567003")).toBe(false);
  });

  it("rejects a grocery EAN-13", () => {
    // 5000... is a UK manufacturer prefix — the barcode on a tin of beans.
    expect(isScannedIsbn("5000112637922")).toBe(false);
  });

  it("rejects the price add-on printed beside the ISBN", () => {
    // Many books carry two barcodes. A scanner that took the first thing it
    // decoded would put the price in the ISBN field.
    expect(isScannedIsbn("54495")).toBe(false);
  });

  it("still requires the checksum, not just the prefix", () => {
    expect(isScannedIsbn("978-0-441-01359-4")).toBe(false);
  });
});
