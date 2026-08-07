import { todayCalendarDate } from "../books/calendar-date";

/**
 * Calendar months, the way the monthly aggregations need them: `YYYY-MM`
 * strings on the outside, integer arithmetic on the inside.
 *
 * Months are counted as `year * 12 + (month - 1)` rather than by adding to a
 * `Date`, because adding a month to a `Date` is the classic wrong answer —
 * January 31st plus one month is March 3rd. An index has no such opinion, and
 * December to January is the same `+ 1` as every other step.
 *
 * In `common/` rather than in `budget/`, where it started: Sprint 7 groups
 * finished books by month exactly as Sprint 6 groups purchases, and the second
 * copy of "what does dense mean, and when does December roll over" is the copy
 * that gets one of the two wrong.
 */

/** A month with a number attached — spending in S6.2, books finished in S7.2. */
export interface MonthValue {
  month: string;
  value: number;
}

/**
 * The month the user is in, from the *local* day — the same choice
 * `todayCalendarDate` makes and for the same reason: someone in Bucharest
 * buying a book at 01:00 on the 1st means the new month, not the old one.
 */
export function currentMonth(now: Date = new Date()): string {
  return todayCalendarDate(now).slice(0, 7);
}

/** The month a `@db.Date` column falls in — the columns are UTC midnight. */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Half-open, `[start, next)`, which is what a date range wants to be: the
 * alternative — `lte` the last day of the month — needs the month's length,
 * and gets February wrong in exactly one year out of four.
 */
export function monthRange(month: string): { start: Date; next: Date } {
  const index = toIndex(month);

  return { start: toDate(index), next: toDate(index + 1) };
}

/**
 * S6.2 and S7.2 — the series a chart draws: every month from the first one with
 * data to `through`, with the empty ones present at zero.
 *
 * The zeros are the point. A month nobody bought a book in — or finished one in
 * — is a real zero, and dropping the row would place January beside April at
 * equal width, a bar chart whose axis quietly stops being time. `through` is
 * normally the current month, so the series runs to today even after a pause; a
 * row dated beyond it still extends the series rather than falling off the end.
 *
 * Neutral in its field name (`value`, not `spent` or `finished`) so that one
 * implementation serves both charts; each service renames it on the way out to
 * the word its own DTO uses.
 */
export function denseMonths(
  rows: Iterable<MonthValue>,
  through: string,
): MonthValue[] {
  const byMonth = new Map<string, number>();

  for (const row of rows) {
    byMonth.set(row.month, row.value);
  }

  if (byMonth.size === 0) {
    // An empty library is an empty chart, not one bar reading zero.
    return [];
  }

  const indices = [...byMonth.keys()].map(toIndex);
  const first = Math.min(...indices);
  const last = Math.max(...indices, toIndex(through));

  const months: MonthValue[] = [];
  for (let index = first; index <= last; index += 1) {
    const month = toMonth(index);
    months.push({ month, value: byMonth.get(month) ?? 0 });
  }

  return months;
}

function toIndex(month: string): number {
  const [year, index] = month.split("-").map(Number);

  return year * 12 + (index - 1);
}

function toMonth(index: number): string {
  const year = Math.floor(index / 12);
  const month = `${(index % 12) + 1}`.padStart(2, "0");

  return `${year}-${month}`;
}

function toDate(index: number): Date {
  return new Date(`${toMonth(index)}-01T00:00:00.000Z`);
}
