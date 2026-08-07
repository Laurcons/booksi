import { z } from "zod";
import { genreSchema, statusSchema, type Status } from "./enums.js";
import { olEditionKeySchema } from "./openlibrary.js";

/**
 * Contracts for the library itself: S1.1–S1.5, the three columns Sprint 2
 * opens for writing — `pagesRead` (S2.1), `rating` (S2.3), `paidPrice` (S2.4) —
 * Sprint 3's wishlist: `estimatedPrice` (S3.2), the `status` filter behind the
 * wishlist view (S3.1) and the summary its total is read from (S3.3) — and
 * Sprint 5's gallery: `favorite` (S5.2) and the filters it is browsed with
 * (S5.3).
 *
 * Two conventions worth stating once, because both are load-bearing:
 *
 * 1. **Calendar days are strings, never `Date`.** `purchasedOn`, `startedOn`
 *    and `finishedOn` are `@db.Date` columns — days, not instants. Sent as an
 *    ISO datetime they pick up a timezone, and a user east of UTC watches
 *    "finished on the 5th" come back as the 4th. `YYYY-MM-DD` has no such
 *    failure mode.
 * 2. **Write schemas are strict.** They accept only the fields the sprints
 *    delivered so far own, and a request carrying anything else is rejected
 *    loudly rather than silently dropped. `favorite` spent four sprints on the
 *    refused side of that rule — a column since the first migration, returned
 *    on read, but unwritable — and S5.2 is the sprint that owns it, so it moves
 *    across here rather than getting a route of its own (§D30).
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

/**
 * Whether a string that already looks like `YYYY-MM-DD` names a day that
 * exists.
 *
 * The pattern alone does not decide this, and the gap is not academic: JS
 * silently rolls an out-of-range day forward, so `2026-02-31` parses to March
 * 3rd and `2026-02-29` — a leap day in a year that has none — to March 1st.
 * Stored without complaint, both come back as a date the user never typed.
 * `2026-13-45` fares differently and no better: it yields an Invalid Date,
 * which reaches the driver instead of the 400 the route documents.
 *
 * Round-tripping through the parser is what tells the three cases apart. A day
 * that survives unchanged is a day that exists.
 */
function isRealCalendarDay(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, "Expected a calendar date as YYYY-MM-DD")
  // Guarded by the pattern test so a malformed string reports the shape
  // problem alone, rather than that and "this day does not exist" together.
  .refine(
    (value) => !CALENDAR_DATE_PATTERN.test(value) || isRealCalendarDay(value),
    "Ziua asta nu există în calendar",
  )
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
export const moneySchema = z
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

  /**
   * S4.3 — where to draw the cover from, or `null` for the books that have
   * none and get the placeholder instead.
   *
   * A path rather than the image, because §D18 keeps the blob in a row of its
   * own precisely so that listing a library does not carry one per line. A
   * flag would have done as much, except for the query string: the image is
   * served `immutable` for a year, so an uploaded replacement has to arrive
   * under a URL the browser has never seen. `?v=` is that, and it is the
   * server's business to compute — a client that has to assemble it is a
   * client that can get it wrong.
   */
  coverUrl: z.string().nullable(),

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
   * S5.2 — orthogonal to status (§D14): a wishlist book nobody has bought yet
   * can be a favourite, so this carries no cross-field rule of its own.
   *
   * Not nullable, and not a tri-state: the column is `Boolean @default(false)`,
   * and "not a favourite" is the same answer as "never marked one".
   */
  favorite: z.boolean().optional(),

  /**
   * S4.1 / S4.2 — the edition the user picked, and the whole mechanism behind
   * §D8's "the image is stored, not the URL": given this key at creation, the
   * server fetches the cover from Open Library and writes it into the `Cover`
   * row. Absent, the book is created without one.
   *
   * The download happens here rather than at the moment of selection, which is
   * the one place the wording in §D8 and the route in ARCHITECTURE.md disagree.
   * The route is right: a book the user searched for, looked at and then
   * abandoned in the form should not have left a blob behind.
   *
   * Failing to fetch it does *not* fail the request. An external service that
   * is down must not stop a book from being added (the degradation criterion);
   * the book simply arrives with the placeholder, and S4.3's upload is the way
   * out.
   */
  olEditionKey: olEditionKeySchema.nullable().optional(),

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
  paidPrice: moneySchema.nullable().optional(),

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
  estimatedPrice: moneySchema.nullable().optional(),

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
 * "Date" is the date the book entered the library; `createdAt` is when the book
 * entered the library, which is the one date every row has.
 *
 * `purchasedOn` joined the list for S8.2, whose default shelf order is the day
 * a book was bought. It was left out originally because the status dates are
 * sparse and would sort mostly nulls — still true, and still the reason the
 * *table* does not offer it as a column header. On the shelf the sparseness is
 * bounded and harmless: the shelf shows owned books only, and MariaDB puts
 * NULLs last under `desc`, so the undated ones queue at the far end instead of
 * leading with a block of blanks.
 */
export const BOOK_SORT_VALUES = [
  "title",
  "author",
  "status",
  "createdAt",
  "purchasedOn",
] as const;

export const bookSortSchema = z.enum(BOOK_SORT_VALUES);
export type BookSort = z.infer<typeof bookSortSchema>;

/**
 * A query-string boolean, spelled out rather than coerced. `z.coerce.boolean`
 * asks JavaScript whether the string is truthy, and `"false"` is a non-empty
 * string — so the coercing version answers `true` to the one input a reader
 * would bet the most on.
 */
const queryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listBooksQuerySchema = z.strictObject({
  sort: bookSortSchema.default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),

  /**
   * S3.1 — the wishlist is `status=WISHLIST` on this route, not a second
   * entity and not a second table. S5.3 makes the same parameter repeatable
   * (`?status=READING&status=FINISHED`), because the gallery's status filter is
   * multi-select. Absent means the whole library.
   *
   * Both shapes are accepted and normalised to an array: Express hands over a
   * string for one occurrence and an array for several, and S3.1's single-value
   * call must keep working exactly as written — a Sprint 5 filter is no reason
   * for a Sprint 3 view to change.
   *
   * Server-side rather than a client-side `filter()` even though S1.2 loads
   * every row: the summary in S3.3 is computed in SQL over exactly this
   * predicate, and a list filtered by a different rule than the total below it
   * is how the two quietly stop agreeing. §D29 extends that reasoning to the
   * other two filters below.
   */
  status: z
    .union([statusSchema, statusSchema.array().min(1)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),

  /**
   * S5.3 — one value, not a set, because a book has exactly one genre (§D17).
   * A multi-valued filter here would advertise a data model that does not
   * exist.
   */
  genre: genreSchema.optional(),

  /**
   * S5.3 — filters on the flag's value. The gallery only ever sends `true`
   * ("just the favourites"), but `false` is accepted and means what it says,
   * which is cheaper than a special case that rejects half of a boolean.
   */
  favorite: queryBoolean.optional(),
});

/**
 * The parsed query — `status` already normalised to an array. Callers building
 * a request (rather than reading one) therefore pass `["WISHLIST"]`, not
 * `"WISHLIST"`; the wire still accepts either.
 */
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

/**
 * S4.2 — an ISBN worth asking Open Library about.
 *
 * Ten or thirteen digits, counted after the punctuation is stripped, because
 * that is how it is printed on the back of a book and how someone will type
 * it. The check is on length alone: the last digit is a checksum and
 * validating it here would turn a typo into "invalid ISBN" when "we could not
 * find it" is both truer and more useful.
 *
 * Deliberately stricter than the `isbn` column, which accepts anything up to
 * 20 characters (§D13 — it is the user's data, and some books carry an ISSN or
 * nothing at all). This one guards a lookup, and a lookup needs a real key.
 */
export const isbnLookupSchema = z
  .string()
  .trim()
  .refine(
    (value) => [10, 13].includes(normalizeIsbn(value).length),
    "Un ISBN are 10 sau 13 cifre",
  )
  .meta({ examples: ["978-0-441-01359-3"] });
