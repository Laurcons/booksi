import type { Status } from "@bookcsi/shared";

/**
 * S1.5 — the rule that makes Sprints 6 and 7 possible.
 *
 * Each status that means something happened on a day records that day. The two
 * that don't, don't: `WISHLIST` is a wish, not an event, and `ABANDONED`
 * deliberately stamps nothing — S1.5 names exactly three dates, and giving
 * abandonment a `finishedOn` would quietly place it on the "books finished per
 * month" chart (S7.2), which §D11 says it must stay off.
 */
export const STATUS_DATE_FIELD = {
  WISHLIST: null,
  PURCHASED: "purchasedOn",
  READING: "startedOn",
  FINISHED: "finishedOn",
  ABANDONED: null,
} as const satisfies Record<Status, StatusDateField | null>;

export type StatusDateField = "purchasedOn" | "startedOn" | "finishedOn";

export interface AutoDateContext {
  /** The status in this request; `undefined` when the request does not touch it. */
  status: Status | undefined;
  /** The stored status, or `null` when the book is being created. */
  previousStatus: Status | null;
  /** Keys the request actually carried — an explicit `null` counts as present. */
  provided: ReadonlySet<string>;
  /** Dates already stored; all `null` at creation. */
  stored: Readonly<Record<StatusDateField, Date | null>>;
}

/**
 * Decides which date, if any, this request should stamp with today.
 *
 * Three rules, in order of precedence:
 *
 * 1. **What the user typed wins.** A date sent explicitly — including `null`,
 *    meaning "I cleared this on purpose" — is never second-guessed. Without
 *    this, the form could not correct a wrong date in the same request that
 *    changes the status.
 * 2. **A date already recorded is never overwritten.** Statuses move back and
 *    forth freely (§D12): re-reading a book returns it to `READING`, and that
 *    must not erase when it was first started, nor when it was bought.
 * 3. **Only an actual transition stamps anything.** Re-sending the status a
 *    book already has is not an event.
 */
export function autoDatedField(context: AutoDateContext): StatusDateField | null {
  const { status, previousStatus, provided, stored } = context;

  if (status === undefined || status === previousStatus) {
    return null;
  }

  const field = STATUS_DATE_FIELD[status];

  if (field === null || provided.has(field) || stored[field] !== null) {
    return null;
  }

  return field;
}
