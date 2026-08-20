import { LOCALES, type PluralMessage } from "@bookcsi/shared";
import { describe, expect, it } from "vitest";
import { catalogs, translatorFor } from "./catalog";
import { ro } from "./ro";

/**
 * Key *parity* between the catalogs is a compile error, not a test: `en.ts` is
 * typed `Catalog<MessageKey>`, so a missing message fails the build. What is
 * left for a test is everything the type cannot see — an entry left blank, one
 * left as its own key, a plural whose fallback form is missing, and the
 * copy-paste that leaves a screen untranslated while still typechecking.
 */

const keys = Object.keys(ro) as (keyof typeof ro)[];

function isPlural(message: unknown): message is PluralMessage {
  return typeof message === "object" && message !== null;
}

describe.each(LOCALES)("the %s catalog", (locale) => {
  const catalog = catalogs[locale];

  it("has no empty message", () => {
    for (const key of keys) {
      const message = catalog[key];

      if (isPlural(message)) {
        for (const [form, text] of Object.entries(message)) {
          expect(text, `${key}.${form}`).not.toBe("");
        }
      } else {
        expect(message, key).not.toBe("");
      }
    }
  });

  it("leaves no message equal to its own key", () => {
    // What an untranslated entry looks like once `translate` has fallen through.
    for (const key of keys) {
      expect(catalog[key], key).not.toBe(key);
    }
  });

  it("gives every plural message the `other` form the fallback relies on", () => {
    // `translate` selects a CLDR category and falls back to `other`; a plural
    // without one would render `undefined` for any category it does not spell
    // out — which for English is most of them.
    for (const key of keys) {
      const message = catalog[key];

      if (isPlural(message)) {
        expect(message.other, `${key}.other`).toBeTypeOf("string");
      }
    }
  });

  it("fills every placeholder it declares, for the plural forms too", () => {
    // A `{count}` left in the output means the call site did not pass it — but a
    // placeholder that exists in one language and not the other means the
    // *translation* dropped a value the sentence needs.
    const t = translatorFor(locale);

    for (const key of keys) {
      const roMessage = ro[key];
      const slots = new Set(
        [...JSON.stringify(roMessage).matchAll(/\{(\w+)\}/g)].map((m) => m[1]),
      );
      const vars = Object.fromEntries([...slots].map((slot) => [slot, 1]));
      const rendered = t(key, vars);

      expect(rendered, key).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("the two catalogs", () => {
  it("differ on the messages that are actually words rather than names", () => {
    // "Wishlist" is the same in both on purpose, and so is "Audiobooks". This
    // guards the other case: a screen's copy pasted across unchanged.
    const shared = keys.filter((key) => {
      const a = catalogs.ro[key];
      const b = catalogs.en[key];

      return typeof a === "string" && typeof b === "string" && a === b;
    });

    // A short, named allow-list beats a threshold: each of these is a decision,
    // and each is a word Romanian took from English unchanged.
    //
    //   nav.wishlist  — "Wishlist" is the word the app has always used.
    //   field.status  — likewise "Status".
    //   field.format  — "Format", the physical dimensions field.
    //   field.rating  — "Rating"; "notă" would be the native word, but the
    //                   interface has said "rating" since Sprint 2.
    expect(shared).toEqual([
      "nav.wishlist",
      "field.status",
      "field.format",
      "field.rating",
    ]);
  });
});
