import { type ErrorKey } from "@bookcsi/shared";
import { AppError } from "./app-error";

/**
 * Turns "row absent" and "row belongs to someone else" into the same outcome
 * (S0.3): a 404, never a 403. A 403 would confirm that the guessed id exists in
 * another user's library, which is exactly the fact we refuse to disclose.
 *
 * The caller is still responsible for querying with `where: { id, userId }` —
 * this helper is what makes such a query safe to `await` directly:
 *
 *   const book = ownedOrNotFound(
 *     await prisma.book.findFirst({ where: { id, userId } }),
 *   );
 *
 * The key defaults to the book wording, since every caller was about a book
 * until `ChallengesService` — pass one explicitly for anything else.
 */
export function ownedOrNotFound<T>(
  row: T | null | undefined,
  key: ErrorKey = "error.book.notFound",
): T {
  if (row === null || row === undefined) {
    // A sentence rather than Nest's bare "Not Found": this is shown to
    // somebody who followed a stale link or a deleted bookmark, and §D27 says
    // an error they can act on gets words they can read.
    throw AppError.notFound(key);
  }

  return row;
}
