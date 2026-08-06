import { isRatable, type Status } from "@bookcsi/shared";

/**
 * S2.3 — when a request may carry a rating.
 *
 * *Which* statuses can hold one is `isRatable` in `shared/`, because the form
 * needs the same answer to decide whether to render the stars. What lives here
 * is the part that is about a request rather than about a status.
 */

/** User-facing, so Romanian: it is attached to the star input by the form. */
export const RATING_STATUS_MESSAGE =
  "Ratingul se poate da doar cărților terminate sau abandonate";

/**
 * Whether a request may set the rating it carries, given the status the book
 * ends up in — `input.status` when the request changes it, the stored one when
 * it does not.
 *
 * Two cases pass regardless of status, and both matter:
 *
 * - **Absent.** The request does not mention the rating, so editing the title
 *   of a re-read book must not fail over a rating set months ago.
 * - **`null`.** Clearing is always allowed. Refusing it would strand a rating
 *   on a book that went back to `READING`, with no way to remove it.
 *
 * Note what this rule does *not* do: it never clears a stored rating by itself.
 * Moving a finished book back to `READING` for a re-read leaves the stars
 * alone, because §D12 makes that transition ordinary and silently discarding
 * data on an ordinary transition is not a thing the API should do.
 */
export function ratingAccepted(
  rating: number | null | undefined,
  status: Status,
): boolean {
  if (rating === undefined || rating === null) {
    return true;
  }

  return isRatable(status);
}
