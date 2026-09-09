import type { Prisma } from "@prisma/client";

/**
 * §D42 — turning `?q=` into a `where` clause.
 *
 * A file of its own, next to `rating.ts` and `status-dates.ts`, for the same
 * reason those exist: the rule is worth testing without booting a controller,
 * and `listWhere` should read as a list of filters rather than as the place
 * search happens to be implemented.
 */

/**
 * The four *scalar* fields a book is recognised by. Order is not significance —
 * the clause is an `OR` and a row matching in any of them matches — it is only
 * the order they are declared in the model.
 *
 * `author` used to be the second entry and is not a column any more (§D51); it
 * is matched through the relation instead, in `searchWhere` below.
 *
 * `description` is in the list at the maintainer's explicit request, and it is
 * the one entry that widens what a hit *means*: it is prose (up to 5000
 * characters, §D40), so a search for "tehnologie" also returns the book whose
 * synopsis says it is *not* about technology. The row gives no hint why it
 * matched, because the matching text is not on screen. That is the accepted
 * trade, written down here rather than rediscovered later.
 *
 * `isbn` matches **as stored**. The column keeps whatever punctuation the user
 * typed (§D13 normalises only for the duplicate check), so `978-606` finds the
 * hyphenated rows and `978606` finds the unhyphenated ones, and neither finds
 * the other. Fixing that would mean `REPLACE()` in SQL — raw, unindexed, and
 * beyond what a search box needs.
 */
const SEARCH_FIELDS = ["title", "publisher", "isbn", "description"] as const;

/**
 * The words of a query, in order, with the gaps between them thrown away.
 *
 * Splitting at all is what makes "tolkien inel" work: as one substring it
 * matches nothing, because no single field holds both words. As two terms —
 * each free to match a different field — it finds the book whose author is
 * Tolkien and whose title mentions the ring.
 *
 * Exported for its own test, and because the shape of the split is the whole
 * behaviour: everything else here is assembling Prisma objects around it.
 */
export function searchTerms(q: string): string[] {
  return q.split(/\s+/).filter((term) => term !== "");
}

/**
 * One `AND` entry per word, each an `OR` across the five fields.
 *
 * The nesting is the feature and it is easy to get backwards. `AND` of `OR`s
 * means *every word must appear somewhere*, which is what narrowing feels
 * like: adding a word to the box can only ever remove rows. An `OR` of `AND`s
 * — or a single `OR` over every word — would do the opposite, and the list
 * would grow as the user typed more of what they were looking for.
 *
 * `%` and `_` inside a term are deliberately left unescaped: Prisma parameterises
 * the value, so this is not an injection, only a user typing a wildcard and
 * getting a wildcard.
 *
 * Case and diacritics need no help here. The database is `utf8mb4_unicode_ci`
 * (pinned in `docker-compose.yml`), which folds both, so `sarpe` finds
 * *Cartea șoaptelor*'s neighbours on the shelf without a normalised column.
 * Prisma's `mode: "insensitive"` is a Postgres feature and must not be added:
 * on MySQL it is unsupported, and the collation already does the work.
 *
 * ## The author is a relation now (§D51)
 *
 * `{ author: { name: { contains: term } } }` is the fifth arm of each `OR`, and
 * it needs no denormalised copy of the name on `Book`. Prisma compiles it to a
 * subquery over `Author`, which changes the plan and not the cost: `contains`
 * is `LIKE '%term%'` and therefore unindexable on **every** field in this
 * clause, so the search was already a scan of the reader's books before §D51
 * and still is. What it now scans in addition is a personal library's author
 * table — hundreds of rows.
 *
 * The **biography is deliberately not searched**, unlike `description`. The
 * two are the same kind of prose and the decision went the other way on
 * purpose: a hit in a description is at least about the book that matched,
 * while a hit in a biography would return every book by an author whose life
 * story happens to contain the word. `q=dune` finding a Herbert novel because
 * his biography mentions Dune is a result nothing on screen could explain.
 */
export function searchWhere(q: string): Prisma.BookWhereInput[] {
  return searchTerms(q).map((term) => ({
    OR: [
      ...SEARCH_FIELDS.map((field) => ({ [field]: { contains: term } })),
      { author: { name: { contains: term } } },
    ],
  }));
}
