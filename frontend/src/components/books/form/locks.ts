import { isRatable, type Status } from "@bookcsi/shared";
import type { MessageKey } from "../../../i18n/catalog";

/**
 * Which fields a book's status has nothing to say about yet, and why.
 *
 * The rule this file exists to express is a design one: **a field that does not
 * apply is disabled, not hidden.** A wishlist book has no page you have reached
 * and no date you finished it, but it will — and a form whose shape changes as
 * the status changes teaches nobody where anything is. So the inputs stay
 * exactly where they were, inert, and the reason is a tooltip rather than a
 * sentence taking up a row.
 *
 * Only `rating` is a rule the server also enforces (`backend/src/books/rating.ts`
 * refuses stars on a status that cannot hold them). The rest are this side's
 * judgement about what is worth offering: the API would accept a `startedOn` on
 * a wishlist book quite happily, and nothing here clears a value that is already
 * stored — flipping a finished book back to `WISHLIST` greys its page count out
 * and keeps it, which is the whole difference between disabling a field and
 * emptying it.
 *
 * Pure, and separate from the components, because these five lines are the part
 * worth testing directly.
 */
export type LockableField =
  | "pagesRead"
  | "startedOn"
  | "finishedOn"
  | "paidPrice"
  | "rating";

/**
 * The message explaining the lock, or `null` when the field is live.
 *
 * Returning the *reason* rather than a boolean is deliberate: every caller that
 * needs to know whether a field is locked also needs something to put in the
 * tooltip, and two functions would let the two answers disagree.
 */
export function lockedReason(
  field: LockableField,
  status: Status,
): MessageKey | null {
  switch (field) {
    // "I have not got the book" is the only state with no page to be on. A
    // bought-but-unstarted book is left open: people read before they get
    // round to moving the status, and page 12 of a `PURCHASED` book is a
    // perfectly ordinary thing to want to record.
    case "pagesRead":
      return status === "WISHLIST" ? "bookForm.lockedProgress" : null;

    case "startedOn":
      return status === "WISHLIST" ? "bookForm.lockedStarted" : null;

    // A book you have not opened has no finish date. `ABANDONED` does — that
    // is what §D11 means by giving up being a verdict — and so does `FINISHED`,
    // which is the case that makes an old book typeable in as read years ago.
    case "finishedOn":
      return status === "WISHLIST" || status === "PURCHASED"
        ? "bookForm.lockedFinished"
        : null;

    // The estimate beside it stays live at every status (§D6): it is what the
    // paid price gets compared against, so it outlives the purchase.
    case "paidPrice":
      return status === "WISHLIST" ? "bookForm.lockedPaid" : null;

    // S2.3 / §D11, and the one lock the API shares.
    case "rating":
      return isRatable(status) ? null : "bookForm.lockedRating";
  }
}
