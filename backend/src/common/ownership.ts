import { NotFoundException } from "@nestjs/common";

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
 */
export function ownedOrNotFound<T>(row: T | null | undefined): T {
  if (row === null || row === undefined) {
    throw new NotFoundException();
  }

  return row;
}
