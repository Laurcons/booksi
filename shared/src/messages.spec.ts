import { describe, expect, it } from "vitest";
import { createBookSchema } from "./book.js";
import { LOCALES, type Locale } from "./locale.js";
import {
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
  errorMessageFor,
  translateIssue,
  zodErrorMap,
} from "./messages.js";

/** The messages a parse produced, as a reader in `locale` would see them. */
function issues(value: unknown, locale: Locale): string[] {
  const parsed = createBookSchema.safeParse(value, {
    error: zodErrorMap(locale),
  });

  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => translateIssue(locale, issue.message));
}

describe("translateIssue", () => {
  it("renders our own keys in both languages", () => {
    expect(translateIssue("ro", "validation.title.required")).toBe(
      "Titlul e obligatoriu",
    );
    expect(translateIssue("en", "validation.title.required")).toBe(
      "A title is required",
    );
  });

  it("passes a sentence through untouched, which is how zod's messages survive", () => {
    // The mechanism the pipe depends on: no branch tells ours from zod's, a
    // catalog miss simply returns what it was given.
    const zodSaid = "Prea mare: așteptat ca string să aibă <=255 caractere";

    expect(translateIssue("ro", zodSaid)).toBe(zodSaid);
  });
});

describe("a real schema, parsed", () => {
  it("reports our labelled constraint in the reader's language", () => {
    expect(issues({ title: "" }, "ro")).toContain("Titlul e obligatoriu");
    expect(issues({ title: "" }, "en")).toContain("A title is required");
  });

  it("localises the constraints we never labelled, via zod's own translations", () => {
    // `.max(255)` on a title carries no message of ours. Before §D44 this came
    // out as English zod-speak in a Romanian interface — a real bug that only a
    // 256-character title could show you.
    const long = { title: "x".repeat(256) };

    const [ro] = issues(long, "ro");
    const [en] = issues(long, "en");

    expect(ro).toMatch(/caractere/);
    expect(en).toMatch(/characters/);
    expect(ro).not.toBe(en);
  });

  it("lets our inline message win over the error map", () => {
    // zod consults the locale map only for issues that have no message already,
    // so a labelled constraint keeps our wording rather than its own.
    expect(issues({ title: "Dune", rating: 9 }, "ro")).toContain(
      "Ratingul e între 1 și 5 stele",
    );
  });

  it("renders every issue when several rules fail at once", () => {
    const both = issues({ title: "", publicationYear: 1200 }, "en");

    expect(both).toContain("A title is required");
    expect(both).toContain("That publication year is implausible");
  });

  it("keeps the two languages apart on the same schema object", () => {
    // The schemas are module-level singletons shared by every request. If a
    // locale ever leaked into one, this is the test that would fail.
    const bad = { title: "" };

    expect(issues(bad, "ro")).toContain("Titlul e obligatoriu");
    expect(issues(bad, "en")).toContain("A title is required");
    expect(issues(bad, "ro")).toContain("Titlul e obligatoriu");
  });
});

describe("catalog coverage", () => {
  it.each(LOCALES)("has no empty or key-shaped message in %s", (locale) => {
    const all = {
      ...VALIDATION_MESSAGES[locale],
      ...ERROR_MESSAGES[locale],
    };

    for (const [key, message] of Object.entries(all)) {
      expect(message, key).not.toBe("");
      // A message equal to its own key is what an untranslated entry looks
      // like once `translate` has fallen through.
      expect(message, key).not.toBe(key);
    }
  });

  it("resolves error keys in both languages", () => {
    expect(errorMessageFor("ro", "error.notFound")).toBe("Nu există.");
    expect(errorMessageFor("en", "error.notFound")).toBe("Not found.");
  });
});
