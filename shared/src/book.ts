import { z } from "zod";
import { genreSchema, statusSchema } from "./enums.js";

/**
 * Sprint 1 contracts for the library itself (S1.1–S1.5).
 *
 * Two conventions worth stating once, because both are load-bearing:
 *
 * 1. **Calendar days are strings, never `Date`.** `purchasedOn`, `startedOn`
 *    and `finishedOn` are `@db.Date` columns — days, not instants. Sent as an
 *    ISO datetime they pick up a timezone, and a user east of UTC watches
 *    "finished on the 5th" come back as the 4th. `YYYY-MM-DD` has no such
 *    failure mode.
 * 2. **Write schemas are strict.** They accept only the fields Sprint 1 owns.
 *    `rating` (S2.3), `pagesRead` (S2.1), `paidPrice` (S2.4),
 *    `estimatedPrice` (S3.2) and `favorite` (S5.2) are already columns and are
 *    already returned on read — S1.2 wants those table columns visible but
 *    empty — yet a request that tries to set them is rejected loudly rather
 *    than silently dropped. Each becomes writable in the sprint that owns it.
 */

export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
});

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

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
