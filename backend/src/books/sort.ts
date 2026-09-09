import type { Prisma } from "@prisma/client";
import type { BookSort } from "@bookcsi/shared";

/**
 * §D51 — turning `?sort=` into Prisma's `orderBy`.
 *
 * A file of its own, next to `search.ts`, and it exists for exactly one reason:
 * four of the five sortable columns are scalars on `Book` and the fifth is not
 * any more. `{ [sort]: order }` worked for all five while `author` was a
 * `VARCHAR`; now it would ask Prisma to order by a *relation*, which is not
 * what a relation field accepts — `{ author: "asc" }` is a type error, and the
 * shape it wants is `{ author: { name: "asc" } }`.
 *
 * Worth a tested function rather than a ternary at the call site, for the same
 * reason `searchWhere` is: this is the second time the sort list has outgrown a
 * one-liner (`purchasedOn` was the first), and the interesting part is not the
 * mapping but what it does to the NULLs — see below.
 */
export function bookOrderBy(
  sort: BookSort,
  order: Prisma.SortOrder,
): Prisma.BookOrderByWithRelationInput[] {
  /**
   * `id` breaks ties so that two books sharing an author (or a status, or a
   * creation timestamp) keep a stable order between requests instead of
   * swapping places on every reload. It was on the previous one-liner too, and
   * it matters more now: ordering by a joined name puts every book by the same
   * author on an equal footing, so the tie-break is the only thing standing
   * between them and an arbitrary order.
   */
  const tieBreak: Prisma.BookOrderByWithRelationInput = { id: "asc" };

  /**
   * The one column that is a relation now.
   *
   * **The NULLs land where they always did**, which is the part worth checking
   * rather than assuming. A book with no author used to have `author IS NULL`
   * on its own row; it now has `authorId IS NULL` and no joined row at all.
   * MariaDB sorts NULL first ascending and last descending in both cases — the
   * left join contributes a NULL name exactly where the column used to — so
   * "sort by author, descending" still ends with the books nobody has named an
   * author for. `books.spec.ts` asserts it, because an equivalence that reads
   * as obvious is the kind that flips quietly.
   */
  if (sort === "author") {
    return [{ author: { name: order } }, tieBreak];
  }

  return [{ [sort]: order }, tieBreak];
}
