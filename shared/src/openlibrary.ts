import { z } from "zod";

/**
 * Sprint 4 — the contracts for the one external source the app has.
 *
 * Everything here describes *our* routes, not Open Library's. The API proxies
 * the whole integration (ARCHITECTURE.md §Open Library): the browser never
 * calls `openlibrary.org`, so what a client sees is this normalised shape
 * rather than the two rather different documents Open Library actually
 * returns.
 */

/**
 * Open Library's own identifiers, and the reason they are validated as
 * patterns rather than accepted as strings: both are interpolated into a URL
 * we then fetch. `OL7353617M` is an edition, `OL45804W` a work (§D7).
 */
export const OL_EDITION_KEY_PATTERN = /^OL\d+M$/;
export const OL_WORK_KEY_PATTERN = /^OL\d+W$/;

export const olEditionKeySchema = z
  .string()
  .regex(OL_EDITION_KEY_PATTERN, "Cheie de ediție Open Library invalidă")
  .meta({ examples: ["OL7353617M"] });

/**
 * S4.1 — the search behind the band at the top of the add dialog.
 *
 * Two characters minimum: the request is debounced at 300ms, so a single
 * letter is a pause in typing rather than a search, and Open Library would
 * answer it with the first ten of half a million works.
 */
export const openLibrarySearchQuerySchema = z.strictObject({
  q: z.string().trim().min(2, "Caută după cel puțin două caractere").max(200),
});

export type OpenLibrarySearchQuery = z.infer<typeof openLibrarySearchQuerySchema>;

/**
 * One row in the results list. A *work* — §D7: the thing a user recognises,
 * with the edition attached rather than chosen.
 *
 * `editionKey` is null surprisingly often; a work whose default edition Open
 * Library never resolved has no cover and no page count to offer, and the row
 * still deserves to be pickable for its title and author.
 */
export const openLibraryResultSchema = z.object({
  workKey: z.string(),
  editionKey: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  firstPublishYear: z.number().int().nullable(),
  /**
   * A path on **this** API, never a `covers.openlibrary.org` URL. Handing the
   * browser the latter is how "the frontend never touches Open Library
   * directly" quietly stops being true — the rule survives exactly as long as
   * nothing renders a foreign URL.
   */
  thumbnailUrl: z.string().nullable(),
});

export type OpenLibraryResult = z.infer<typeof openLibraryResultSchema>;

/**
 * What gets poured into the form — by S4.1 when a result is picked, and by
 * S4.2 when an ISBN is typed. One shape for both, because both answer the same
 * question about the same edition; only the way in differs.
 *
 * Every field is nullable but `title`. Open Library's coverage is uneven —
 * §D4 exists because the page count is missing more often than not — and a
 * partial fill beats refusing to fill anything.
 */
export const bookSuggestionSchema = z.object({
  title: z.string(),
  author: z.string().nullable(),
  isbn: z.string().nullable(),
  totalPages: z.number().int().nullable(),
  publisher: z.string().nullable(),
  publicationYear: z.number().int().nullable(),
  format: z.string().nullable(),
  /**
   * Sent back with `POST /books`, which is what makes the server download the
   * cover. Null when Open Library has no edition to point at, and the book is
   * then created without one — S4.3's placeholder covers that case.
   */
  olEditionKey: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
});

export type BookSuggestion = z.infer<typeof bookSuggestionSchema>;
