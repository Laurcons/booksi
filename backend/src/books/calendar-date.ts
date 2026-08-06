/**
 * `purchasedOn`, `startedOn` and `finishedOn` are `@db.Date` columns: calendar
 * days, with no time and no zone. Prisma still hands them over as `Date`
 * objects, pinned at midnight UTC, and expects the same on the way in — so all
 * conversion here goes through UTC and the day survives the round trip.
 */

export function toCalendarDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function fromCalendarDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

/**
 * Deliberately the *local* day, not the UTC one. This is the date stamped on a
 * status transition (S1.5), and a reader in Bucharest who finishes a book at
 * 01:00 means today, not yesterday. The server's zone stands in for the
 * user's; asking the browser for its offset would buy accuracy nobody would
 * notice, at the cost of a client-supplied value in a system-generated field.
 */
export function todayCalendarDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
