import { describe, expect, it } from "vitest";
import { type Catalog, translate, translator } from "./i18n.js";

const catalog = {
  plain: "Biblioteca ta",
  greeting: "Bine ai venit, {name}",
  twice: "{what} și iar {what}",
  books: {
    one: "{count} carte",
    few: "{count} cărți",
    other: "{count} de cărți",
  },
  englishBooks: {
    one: "{count} book",
    other: "{count} books",
  },
} satisfies Catalog<string>;

type Key = keyof typeof catalog;

const ro = (key: Key, vars?: Record<string, string | number>) =>
  translate("ro", catalog, key, vars);

describe("translate", () => {
  it("returns a plain message untouched", () => {
    expect(ro("plain")).toBe("Biblioteca ta");
  });

  it("fills placeholders, including a repeated one", () => {
    expect(ro("greeting", { name: "Laur" })).toBe("Bine ai venit, Laur");
    expect(ro("twice", { what: "din nou" })).toBe("din nou și iar din nou");
  });

  it("leaves an unfilled placeholder standing, so the bug is visible", () => {
    // "Bine ai venit, " reads like a sentence someone wrote on purpose;
    // "{name}" does not.
    expect(ro("greeting")).toBe("Bine ai venit, {name}");
    expect(ro("greeting", { other: "x" })).toBe("Bine ai venit, {name}");
  });

  it("returns the key itself for a message that is not there", () => {
    // Unreachable through the typed `t()`; this guards the dynamic lookups.
    expect(translate("ro", catalog, "nope" as Key)).toBe("nope");
  });

  it("inserts numbers as written rather than grouped", () => {
    // `formatCount(2026)` is "2.026", which is not a year in any locale.
    expect(ro("books", { count: 2026 })).toBe("2026 de cărți");
  });
});

describe("plural selection", () => {
  it("picks Romanian's three forms at the boundaries CLDR puts them", () => {
    expect(ro("books", { count: 1 })).toBe("1 carte");
    expect(ro("books", { count: 2 })).toBe("2 cărți");
    expect(ro("books", { count: 19 })).toBe("19 cărți");
    expect(ro("books", { count: 20 })).toBe("20 de cărți");
    expect(ro("books", { count: 100 })).toBe("100 de cărți");
  });

  it("returns to the 'de'-less form inside a hundred, which is the rule everyone forgets", () => {
    expect(ro("books", { count: 101 })).toBe("101 cărți");
    expect(ro("books", { count: 119 })).toBe("119 cărți");
    expect(ro("books", { count: 120 })).toBe("120 de cărți");
  });

  it("says '0 cărți', which the hand-rolled rule this replaces got wrong", () => {
    // The old `plural()` treated a last-two-digits of 0 as needing "de" and
    // produced "0 de cărți". CLDR puts 0 in `few`.
    expect(ro("books", { count: 0 })).toBe("0 cărți");
  });

  it("falls back to `other` for a category the locale does not spell out", () => {
    // English supplies one/other; `few` is never selected for it, but the
    // fallback is what lets both languages share one catalog type.
    expect(translate("en", catalog, "englishBooks", { count: 1 })).toBe("1 book");
    expect(translate("en", catalog, "englishBooks", { count: 20 })).toBe("20 books");
  });

  it("uses `other` when a plural message is given nothing to count", () => {
    expect(ro("books")).toBe("{count} de cărți");
  });
});

describe("translator", () => {
  it("binds a locale and a catalog for the non-React callers", () => {
    const t = translator("ro", catalog);

    expect(t("books", { count: 3 })).toBe("3 cărți");
    expect(t("plain")).toBe("Biblioteca ta");
  });
});
