import { describe, expect, it } from "vitest";
import {
  AUTHOR_BIOGRAPHY_MAX,
  createAuthorSchema,
  foldAuthorName,
  listAuthorsQuerySchema,
  sameAuthorName,
  updateAuthorSchema,
} from "./author.js";

/**
 * §D51 — the folding rule, which is the one piece of this feature that has to
 * agree with a database collation it cannot see.
 *
 * `Author.name` collates `utf8mb4_unicode_ci`, so MariaDB considers two names
 * the same when they differ only in case or in accents. The client decides
 * whether to *offer* to create an author by asking the same question, and if
 * the two disagree it offers to create a row the server resolves to an existing
 * one. These tests are that agreement, written down.
 */
describe("foldAuthorName (§D51)", () => {
  it("ignores case, the way the collation does", () => {
    expect(sameAuthorName("Frank Herbert", "frank herbert")).toBe(true);
    expect(sameAuthorName("BELL HOOKS", "bell hooks")).toBe(true);
  });

  it("ignores diacritics, the way the collation does", () => {
    expect(sameAuthorName("Mircea Cărtărescu", "Mircea Cartarescu")).toBe(true);
    expect(sameAuthorName("George Călinescu", "george calinescu")).toBe(true);
    expect(sameAuthorName("Șerban", "serban")).toBe(true);
    expect(sameAuthorName("Ștefan Țepeș", "Stefan Tepes")).toBe(true);
  });

  it("ignores surrounding whitespace, which a typed name collects", () => {
    expect(sameAuthorName("  Frank Herbert  ", "Frank Herbert")).toBe(true);
  });

  /**
   * The other half of the guarantee: folding must not collapse people who are
   * genuinely different, or the picker would refuse to create an author that
   * does not exist yet.
   */
  it("keeps different names apart", () => {
    expect(sameAuthorName("Frank Herbert", "Frank Herberts")).toBe(false);
    expect(sameAuthorName("Frank Herbert", "Brian Herbert")).toBe(false);
    // Inner whitespace is significant — two names, not one.
    expect(sameAuthorName("Le Guin", "LeGuin")).toBe(false);
  });

  it("folds to something stable and lowercase", () => {
    expect(foldAuthorName("Mircea Cărtărescu")).toBe("mircea cartarescu");
  });
});

describe("the author schemas (§D51)", () => {
  it("requires a name, and trims it", () => {
    expect(createAuthorSchema.parse({ name: "  Frank Herbert " })).toEqual({
      name: "Frank Herbert",
    });
    expect(createAuthorSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  /**
   * A biography is written after the author exists, so it has no place on the
   * creation request — and the schema is strict, so saying so is a 400 rather
   * than a silently dropped field.
   */
  it("refuses a biography at creation", () => {
    expect(
      createAuthorSchema.safeParse({ name: "Frank Herbert", biography: "Ceva." })
        .success,
    ).toBe(false);
  });

  it("refuses a name change on update, at any spelling", () => {
    expect(updateAuthorSchema.safeParse({ name: "Altcineva" }).success).toBe(false);
    expect(
      updateAuthorSchema.safeParse({ biography: "Ceva.", name: "Altcineva" }).success,
    ).toBe(false);
  });

  it("stores an emptied biography as NULL, not as an empty string", () => {
    expect(updateAuthorSchema.parse({ biography: "" })).toEqual({ biography: null });
    expect(updateAuthorSchema.parse({ biography: "   " })).toEqual({ biography: null });
    expect(updateAuthorSchema.parse({ biography: null })).toEqual({ biography: null });
  });

  it("caps the biography where the column and the counter agree it caps", () => {
    expect(
      updateAuthorSchema.safeParse({ biography: "a".repeat(AUTHOR_BIOGRAPHY_MAX) })
        .success,
    ).toBe(true);
    expect(
      updateAuthorSchema.safeParse({ biography: "a".repeat(AUTHOR_BIOGRAPHY_MAX + 1) })
        .success,
    ).toBe(false);
  });

  /**
   * §D29's absent-vs-empty rule, applied to the picker's query: a
   * hand-written `?q=` has to mean "no filter" rather than "the substring every
   * name contains".
   */
  it("treats an empty q as absent", () => {
    expect(listAuthorsQuerySchema.parse({ q: "" })).toEqual({ q: undefined });
    expect(listAuthorsQuerySchema.parse({ q: "  " })).toEqual({ q: undefined });
    expect(listAuthorsQuerySchema.parse({})).toEqual({ q: undefined });
    expect(listAuthorsQuerySchema.parse({ q: " herb " })).toEqual({ q: "herb" });
  });
});
