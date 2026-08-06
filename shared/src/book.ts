import { z } from "zod";
import { genreSchema, statusSchema, type Status } from "./enums.js";

/**
 * Contracts for the library itself: S1.1–S1.5, the three columns Sprint 2
 * opens for writing — `pagesRead` (S2.1), `rating` (S2.3), `paidPrice` (S2.4) —
 * and Sprint 3's wishlist: `estimatedPrice` (S3.2), the `status` filter behind
 * the wishlist view (S3.1) and the summary its total is read from (S3.3).
 *
 * Two conventions worth stating once, because both are load-bearing:
 *
 * 1. **Calendar days are strings, never `Date`.** `purchasedOn`, `startedOn`
 *    and `finishedOn` are `@db.Date` columns — days, not instants. Sent as an
 *    ISO datetime they pick up a timezone, and a user east of UTC watches
 *    "finished on the 5th" come back as the 4th. `YYYY-MM-DD` has no such
 *    failure mode.
 * 2. **Write schemas are strict.** They accept only the fields the sprints
 *    delivered so far own. `favorite` (S5.2) is already a column and is
 *    already returned on read — S1.2 wants that table column visible but
 *    empty — yet a request that tries to set it is rejected loudly rather than
 *    silently dropped. It becomes writable in the sprint that owns it, the way
 *    `estimatedPrice` just did in S3.2.
 *
 * There is no `progress` field anywhere here, and that is S2.2 working as
 * specified: the percentage is `pagesRead / totalPages`, derived on display and
 * never stored (§D4, and the "valori derivate" list in DECISIONS.md).
 */

export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * S2.3 — the statuses a rating may sit on.
 *
 * `FINISHED` is obvious; `ABANDONED` is here because §D11 says so outright —
 * giving up on a book is itself a verdict, and one worth two stars.
 *
 * Shared rather than server-side because both ends need the same answer for
 * different reasons: the API refuses a rating that arrives on the wrong status,
 * and the form has to know whether to offer the stars at all. Two copies of
 * this list would drift the day one of them changed.
 */
export const RATABLE_STATUSES = [
  "FINISHED",
  "ABANDONED",
] as const satisfies readonly Status[];

export function isRatable(status: Status): boolean {
  return (RATABLE_STATUSES as readonly Status[]).includes(status);
}

export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, "Expected a calendar date as YYYY-MM-DD")
  // Carried into the generated OpenAPI schema. Without it, tooling invents a
  // string that merely satisfies the pattern — "5843-15-01" and the like,
  // which teaches a reader the wrong shape.
  .meta({ examples: ["2026-08-06"] });

/** A cleared form field arrives as `""`; the column stores NULL. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

/**
 * Money on the wire: a plain number with at most two decimals, bounded by the
 * `DECIMAL(10,2)` column behind it — eight integer digits, two fractional.
 * Rejecting a third decimal here beats letting MariaDB round 12.345 to 12.35
 * and reporting the rounded value back as though it were what was sent.
 *
 * `multipleOf` rather than a hand-rolled check: zod compares the ratio against
 * a relative epsilon, so 59.9 passes despite its binary expansion, and the
 * constraint also survives into the generated OpenAPI schema.
 */
const money = z
  .number()
  .nonnegative("Suma nu poate fi negativă")
  .max(99_999_999.99, "Sumă prea mare")
  .multipleOf(0.01, "Cel mult două zecimale");

export const bookSchema = z.object({
  id: z.string(),

  title: z.string(),
  author: z.string().nullable(),
  isbn: z.string().nullable(),
  totalPages: z.number().int().nullable(),
  genre: genreSchema.nullable(),

  status: statusSchema,
  favorite: z.boolean(),
  pagesRead: z.number().int(),
  rating: z.number().int().nullable(),

  // Stored as DECIMAL(10,2) so that the Sprint 6 sums stay exact in SQL. On
  // the wire they are plain numbers: two decimals below 10^8 are represented
  // exactly by a double, and nothing adds them up client-side.
  estimatedPrice: z.number().nullable(),
  paidPrice: z.number().nullable(),

  purchasedOn: calendarDateSchema.nullable(),
  startedOn: calendarDateSchema.nullable(),
  finishedOn: calendarDateSchema.nullable(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Book = z.infer<typeof bookSchema>;

/**
 * S1.1: only the title is required. Everything else — author, ISBN, page
 * count, genre — is optional, because a book you are adding from memory
 * rarely has all of it to hand.
 *
 * `status` is accepted at creation (not only through a later transition) so
 * that an existing shelf can be typed in as `FINISHED` directly; §D12 rejects
 * the idea that the flow is a constraint.
 */
export const createBookSchema = z.strictObject({
  title: z.string().trim().min(1, "Titlul e obligatoriu").max(255),
  author: nullableText(255).optional(),
  isbn: nullableText(20).optional(),
  totalPages: z.number().int().positive().max(100_000).nullable().optional(),
  genre: genreSchema.nullable().optional(),
  status: statusSchema.optional(),

  /**
   * S2.1 — one current value, never a history of sessions (§D3).
   *
   * Deliberately *not* capped at `totalPages`. That number is absent for most
   * non-English editions and, when Open Library does supply it, belongs to an
   * edition the user never picked (§D4, §D7) — so a wrong page count would
   * lock someone out of recording where they actually are. The bar clamps at
   * 100% on display; the column keeps what was typed.
   *
   * Not nullable, unlike its neighbours: the column is `Int @default(0)`, and
   * "I haven't started" is 0 pages, not an unknown.
   */
  pagesRead: z.number().int().min(0, "Paginile citite nu pot fi negative").max(100_000).optional(),

  /**
   * S2.3 — whole stars, 1 to 5, no halves. Nullable because un-rating a book
   * is a real edit, and because `null` is what §D5 excludes from the average.
   *
   * Which statuses may carry a rating is a cross-field rule, so it cannot live
   * here — the answer depends on the stored book as well as on the request.
   * The server owns it; see `backend/src/books/rating.ts`.
   */
  rating: z
    .number()
    .int("Ratingul e în stele întregi")
    .min(1, "Ratingul e între 1 și 5 stele")
    .max(5, "Ratingul e între 1 și 5 stele")
    .nullable()
    .optional(),

  /**
   * S2.4 — the sum actually paid, a different field from the wishlist estimate
   * (§D6). Only this one feeds the Sprint 6 budget, which is the whole reason
   * the two are not one column.
   */
  paidPrice: money.nullable().optional(),

  /**
   * S3.2 — what the user guesses a wishlist book will cost. Open Library
   * publishes no prices, so this is user-input or nothing.
   *
   * Optional in the strong sense: a book sits in the wishlist perfectly well
   * without one, and S3.3 is written around that gap rather than against it —
   * the total says how many books it covers instead of pretending to be
   * complete.
   *
   * Not restricted to `WISHLIST`. Nothing in S3.2 asks for that, and an
   * estimate is worth keeping after the purchase: it is what the paid price
   * gets compared against.
   */
  estimatedPrice: money.nullable().optional(),

  // Supplying a date explicitly overrides the automatic one (S1.5).
  purchasedOn: calendarDateSchema.nullable().optional(),
  startedOn: calendarDateSchema.nullable().optional(),
  finishedOn: calendarDateSchema.nullable().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;

/** S1.3: any field is editable at any time, so the same surface, all optional. */
export const updateBookSchema = createBookSchema.partial();

export type UpdateBookInput = z.infer<typeof updateBookSchema>;

/**
 * S1.2. Sorting by `status` orders by the enum's declaration order, which is
 * the reading flow itself (wishlist → purchased → reading → finished →
 * abandoned) rather than alphabetical — the useful order, and free.
 * "Date" is the date the book entered the library; the three status dates are
 * sparse by nature and would sort mostly nulls.
 */
export const BOOK_SORT_VALUES = [
  "title",
  "author",
  "status",
  "createdAt",
] as const;

export const bookSortSchema = z.enum(BOOK_SORT_VALUES);
export type BookSort = z.infer<typeof bookSortSchema>;

export const listBooksQuerySchema = z.strictObject({
  sort: bookSortSchema.default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),

  /**
   * S3.1 — the wishlist is `status=WISHLIST` on this route, not a second
   * entity and not a second table. Absent means the whole library.
   *
   * Server-side rather than a client-side `filter()` even though S1.2 loads
   * every row: the summary in S3.3 is computed in SQL over exactly this
   * predicate, and a list filtered by a different rule than the total below it
   * is how the two quietly stop agreeing.
   */
  status: statusSchema.optional(),
});

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

/**
 * S3.3 — what the wishlist would cost, plus how much of the wishlist that
 * figure actually speaks for.
 *
 * The coverage is not decoration. A total summed over the books that have an
 * estimate, displayed alone, reads as the price of the whole list and is wrong
 * by however many books were left blank — so the story asks for both numbers
 * in one breath: "total 340 lei — 7 din 11 cărți au preț estimat".
 *
 * Derived on every request, never stored: DECISIONS.md lists
 * `cost_total_wishlist` among the values that are always computed.
 */
export const wishlistSummarySchema = z.object({
  /** Summed over the priced books only; `0` when none of them has a price. */
  total: z.number(),
  /** Wishlist books carrying an estimate — the "7". */
  priced: z.number().int(),
  /** Wishlist books in total — the "11". */
  count: z.number().int(),
});

export type WishlistSummary = z.infer<typeof wishlistSummarySchema>;

/**
 * S1.1 / §D13: the same ISBN may legitimately appear twice (a re-read, a
 * second edition). The API therefore never blocks a duplicate — it only
 * answers "do you already own this?", so the form can say so while the user
 * is still typing.
 */
export const isbnDuplicatesQuerySchema = z.strictObject({
  isbn: z.string().trim().min(1),
  /** Set while editing, so a book does not report itself as its own duplicate. */
  excludeId: z.string().optional(),
});

export type IsbnDuplicatesQuery = z.infer<typeof isbnDuplicatesQuerySchema>;

export const isbnDuplicateSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
});

export type IsbnDuplicate = z.infer<typeof isbnDuplicateSchema>;

/**
 * ISBNs are stored exactly as typed, hyphens and all — it is the user's data,
 * and reformatting it is not ours to do. Comparison, on the other hand, has to
 * ignore the punctuation: `978-606-4` and `9786064` are the same book.
 */
export function normalizeIsbn(value: string): string {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}
