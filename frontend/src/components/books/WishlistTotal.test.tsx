import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { translatorFor } from "../../i18n/catalog";
import { coverage } from "../../lib/wishlist-coverage";
import { WishlistTotal } from "./WishlistTotal";
import { renderWithQuery } from "../../test/helpers";

describe("WishlistTotal — the total (S3.3)", () => {
  it("shows the sum and what it covers together", () => {
    renderWithQuery(<WishlistTotal summary={{ total: 340, priced: 7, count: 11 }} />);

    // The story's own line: "total 340 lei — 7 din 11 cărți au preț estimat".
    expect(screen.getByText(/340\.00/)).toBeInTheDocument();
    expect(screen.getByText("lei")).toBeInTheDocument();
    expect(
      screen.getByText("7 din 11 cărți au preț estimat."),
    ).toBeInTheDocument();
  });

  it("shows money to two decimals", () => {
    renderWithQuery(<WishlistTotal summary={{ total: 59.9, priced: 1, count: 2 }} />);

    expect(screen.getByText(/59\.90/)).toBeInTheDocument();
  });
});

const ro = translatorFor("ro");
const en = translatorFor("en");

describe("WishlistTotal — the coverage line (S3.3)", () => {
  it("names both numbers when only some books have a price", () => {
    expect(coverage({ total: 340, priced: 7, count: 11 }, ro)).toBe(
      "7 din 11 cărți au preț estimat.",
    );
  });

  it("says so plainly when nothing is priced, instead of '0 din 4'", () => {
    // The total would read 0.00 next to it, which without this sentence looks
    // like a wishlist that costs nothing rather than one nobody has priced.
    expect(coverage({ total: 0, priced: 0, count: 4 }, ro)).toBe(
      "Nicio carte n-are încă un preț estimat.",
    );
  });

  it("stops qualifying the total once every book has a price", () => {
    expect(coverage({ total: 340, priced: 11, count: 11 }, ro)).toBe(
      "Toate cele 11 cărți au preț estimat.",
    );
  });

  it("uses 'de cărți' from twenty up", () => {
    // The Romanian rule everyone forgets. It used to need a hand-rolled noun
    // here, because the count and the noun sit apart in this sentence; §D44
    // moved it to `Intl.PluralRules`, which puts 20 in `other` and 19 in `few`.
    expect(coverage({ total: 10, priced: 3, count: 20 }, ro)).toBe(
      "3 din 20 de cărți au preț estimat.",
    );
    expect(coverage({ total: 10, priced: 3, count: 19 }, ro)).toBe(
      "3 din 19 cărți au preț estimat.",
    );
  });

  it("says it in English for an English reader, with no 'de' rule to apply", () => {
    // The same three shapes, and the reason the catalog holds whole sentences:
    // English needs neither the particle nor the verb agreement Romanian does.
    expect(coverage({ total: 10, priced: 3, count: 20 }, en)).toBe(
      "3 of 20 books have an estimated price.",
    );
    expect(coverage({ total: 0, priced: 0, count: 4 }, en)).toBe(
      "No book has an estimated price yet.",
    );
    expect(coverage({ total: 340, priced: 11, count: 11 }, en)).toBe(
      "All 11 books have an estimated price.",
    );
  });

  it("keeps the singular readable", () => {
    expect(coverage({ total: 59.9, priced: 1, count: 1 }, ro)).toBe(
      "Singura carte din wishlist are preț estimat.",
    );
  });
});
