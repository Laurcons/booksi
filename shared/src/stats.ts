import { z } from "zod";
import { monthSchema } from "./budget.js";

/**
 * Sprint 7 and the reading half of Sprint 8 — what the library says about the
 * reading, as opposed to about the money.
 *
 * Three rules run through every shape here:
 *
 * 1. **One aggregation rule for pages, defined once** (§D10). The term used to
 *    mean two different things — the sum of every page on the shelf, and the
 *    pages actually read — and it now means only the second. The table is in
 *    S7.1 and it is implemented in exactly one place, `StatsService`.
 * 2. **Everything is derived, never stored.** Same as the budget: computed in
 *    SQL on request, so no stored total can drift from the books it came from.
 * 3. **The dashboard and the statistics page read the same numbers from the
 *    same endpoint** (S8.1). Two endpoints computing "cărți citite" would agree
 *    on the day they were written and on no day after it.
 */

/**
 * S7.1, plus the reading figures S8.1 puts on the dashboard — one response,
 * because they are the same four questions asked from two screens.
 *
 * `booksReading` is here only for the dashboard and `averageRating` only for
 * the statistics page, which is the point: a superset of both, computed once.
 * Splitting them would be two queries over the same rows and the eventual
 * chance for the two screens to disagree.
 */
export const statsOverviewSchema = z.object({
  /** §D11 — abandoning a book is a verdict, but it is not having read it. */
  booksFinished: z.number().int(),

  booksReading: z.number().int(),

  /** §D10, and only §D10. */
  pagesRead: z.number().int(),

  /**
   * Averaged over the rated books alone, `null` when none are rated.
   *
   * Counting an unrated book as zero would not produce a lower average, it
   * would produce a wrong one: no rating is an absence, not a verdict of
   * nought. And an empty library has no average at all — `0` would read as
   * "you hated everything".
   */
  averageRating: z.number().nullable(),
});

export type StatsOverview = z.infer<typeof statsOverviewSchema>;

export const readingMonthSchema = z.object({
  month: monthSchema,
  finished: z.number().int(),
});

export type ReadingMonth = z.infer<typeof readingMonthSchema>;

/**
 * S7.2 — books finished per month, oldest first.
 *
 * **Dense, like S6.2's series and for the same reason** (§D31): a month in
 * which nothing was finished is a real zero, and dropping the row would put
 * January beside April at equal width — a bar chart whose axis quietly stops
 * being time. The series runs from the first dated finish to the current month.
 *
 * `undated` is a **count, not a sum**. S7.2 asks for the excluded books to be
 * stated explicitly, and what is excluded here is a book, not an amount of
 * money — the budget's `UndatedSpend` answers a different question and does not
 * transfer. The case is the ordinary one, not an edge: a shelf typed in
 * retroactively arrives as `Terminat` without ever transitioning into it, so
 * S1.5 never stamps `finishedOn`.
 */
export const statsByMonthSchema = z.object({
  months: z.array(readingMonthSchema),
  undated: z.number().int(),
});

export type StatsByMonth = z.infer<typeof statsByMonthSchema>;
