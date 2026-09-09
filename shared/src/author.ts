import { z } from "zod";

/**
 * §D51 — the author as an entity, and the contracts the picker is built on.
 *
 * The author used to be a `String?` column on `Book` and nothing else: two
 * books by the same person held two copies of the name, and there was nowhere
 * to write down who that person was. §D51 turns it into a row of its own with
 * one field the old column could not carry — a biography — and that single
 * addition is what forces every other decision in this file.
 *
 * **Authors are per-user.** The biography is the reader's own prose, the way
 * `Book.description` is; the autocomplete may only offer names from the
 * reader's own shelves; and a delete must not reach across accounts. A shared
 * author table would mean one reader's edit rewriting a stranger's book page,
 * which is also what would make the "applies to all your books" note in the
 * form a lie.
 *
 * **The wire is keyed by id, never by name.** A name-keyed write with
 * resolve-or-create behaviour *is* silent creation, and a misspelling must not
 * mint an author (see `POST /authors`, the one deliberate way to make one).
 */

/** Same ceiling as the old `Book.author` column, so no name can fail to migrate. */
export const AUTHOR_NAME_MAX = 255;

/**
 * As long as a book's description (§D40) and for the same reason: a model reads
 * it back through `get_book`, so the cap is set by what is cheap to pour into a
 * context window rather than by what TEXT can hold. A biography is a synopsis
 * of a person; the reader's *own* prose gets twice this (`Book.review`),
 * because nobody reads that back but its author.
 */
export const AUTHOR_BIOGRAPHY_MAX = 5000;

/** The author as it rides on a book, and as `GET /authors/:id` answers. */
export const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  biography: z.string().nullable(),
});

export type Author = z.infer<typeof authorSchema>;

/**
 * `GET /authors/:id` — the author plus how many books carry it.
 *
 * The count is here and **not** on `authorSchema`, which is the version
 * embedded in every book. The difference is what it would cost: a `COUNT` per
 * author per book row, on a route that lists a whole library, to render a number
 * only the edit form's one line of prose ever shows. This route is called by
 * that form and by nothing else, so the count travels with it.
 */
export const authorDetailSchema = authorSchema.extend({
  bookCount: z.number().int(),
});

export type AuthorDetail = z.infer<typeof authorDetailSchema>;

/**
 * One row of the picker's dropdown — the payload of `GET /authors`.
 *
 * Deliberately **not** an `Author`: the biography is up to 5000 characters and
 * a dropdown never shows it, so a list of ten suggestions would carry 50KB of
 * prose nobody asked for. The biography arrives by the two routes that need
 * it — on the book itself, and from `GET /authors/:id` when the reader switches
 * to a different author — which also keeps it cached under a key that a
 * `PATCH /authors/:id` can invalidate precisely.
 *
 * `bookCount` is not decoration. It is the number in "applies to all 4 books by
 * Frank Herbert", and it is what decides whether deleting this author needs a
 * confirmation at all (§D51: an author nobody's books point at is deleted on
 * the spot, because there is nothing to warn about).
 */
export const authorSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  bookCount: z.number().int(),
});

export type AuthorSuggestion = z.infer<typeof authorSuggestionSchema>;

/**
 * `GET /authors?q=` — server-backed, unlike the client-side filter this
 * replaces.
 *
 * The old `AuthorInput` filtered the already-fetched book list in the browser
 * and argued in its own comment that a personal library is small enough for
 * that to beat an endpoint. That reasoning does not survive §D51: an author is
 * now a row that exists whether or not a book points at it, it carries a
 * `bookCount` no book response holds, and it is created and deleted while the
 * form is open. None of those are answerable from a cached list of books.
 *
 * `q` absent is not an error and not empty — it is the reader's whole author
 * list, in name order. That is what makes the dropdown usable for the one piece
 * of housekeeping §D51 leaves in it: there is no central author management, so
 * deleting an author nobody uses has to be possible from the picker without
 * first knowing its name.
 */
export const listAuthorsQuerySchema = z.strictObject({
  /**
   * Trimmed, and empty means absent — the same rule as `?q=` on books (§D42).
   * A hand-written `?q=` must mean "no filter" rather than "the substring every
   * name contains".
   */
  q: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type ListAuthorsQuery = z.infer<typeof listAuthorsQuerySchema>;

/**
 * `POST /authors` — the deliberate creation, and the only way an author comes
 * into being.
 *
 * It takes a name and nothing else. A biography is written *after* the author
 * exists, through `PATCH /authors/:id`, because the click that creates one is a
 * click on a row in a dropdown and there is no prose in it.
 */
export const createAuthorSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "validation.author.nameRequired")
    .max(AUTHOR_NAME_MAX),
});

export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;

/**
 * `PATCH /authors/:id` — the biography, and only the biography.
 *
 * **A name cannot be edited**, which is a decision rather than an omission.
 * Renaming an author is indistinguishable on the wire from correcting a typo
 * and from merging two people, and the third one silently rewrites every book
 * that pointed at the old name. Until there is a screen that says which of the
 * three is happening, the way to fix a misspelled author is to create the right
 * one, point the book at it, and delete the wrong one — three deliberate acts,
 * each of which says what it is.
 */
export const updateAuthorSchema = z.strictObject({
  /** `""` from an emptied textarea stores NULL, like every other prose field. */
  biography: z
    .string()
    .trim()
    .max(AUTHOR_BIOGRAPHY_MAX)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>;

/**
 * What `DELETE /authors/:id` answers with.
 *
 * The count is not something the client could not work out — it is exactly what
 * the confirmation it just showed was based on. It comes back anyway because
 * that number may have moved since the dropdown was drawn (a book added in
 * another tab, an MCP call), and a message that reports what *happened* rather
 * than what was predicted is the difference between feedback and an echo.
 */
export const deleteAuthorResultSchema = z.object({
  booksAffected: z.number().int(),
});

export type DeleteAuthorResult = z.infer<typeof deleteAuthorResultSchema>;

/**
 * A name folded down to what the database considers the *same* name.
 *
 * The `Author` table's unique index is `@@unique([userId, name])` on a
 * `utf8mb4_unicode_ci` column, and that collation is both case- and
 * accent-insensitive: to MariaDB, `frank herbert` is already `Frank Herbert`,
 * and `Calinescu` is already `Călinescu`. That is the intended strictness —
 * `bell hooks` and `Bell Hooks` are one person, and so are the two spellings of
 * Călinescu — but it means the *client* cannot decide whether a typed name is
 * new by comparing strings.
 *
 * Which is exactly what it has to decide: the "create this author" row appears
 * only when nothing matches, so a comparison stricter than the database's would
 * offer to create a name the database will hand back as an existing row.
 *
 * NFD-decompose, drop the combining marks, lowercase. Not a reimplementation of
 * UCA — `ß`/`ss` and a handful of other equivalences fold in the collation and
 * not here — and it does not need to be: the server is the authority, `POST
 * /authors` resolves a collision to the author that already exists rather than
 * failing, and the worst a disagreement costs is a create row that turns out to
 * select instead of insert. A safe direction to be wrong in, which is why the
 * approximation is allowed to be one.
 */
export function foldAuthorName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Whether a typed name is the one already selected — folded, as above. */
export function sameAuthorName(a: string, b: string): boolean {
  return foldAuthorName(a) === foldAuthorName(b);
}
