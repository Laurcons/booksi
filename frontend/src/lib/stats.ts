import type { Book } from "@bookcsi/shared";

/**
 * The aggregates S8.1 puts on the dashboard, derived and never stored — the
 * "valori derivate" list in DECISIONS.md.
 *
 * These were written against the mock's own `Book` type while the dashboard was
 * a design study. They are typed against the API's book now, which is what they
 * will actually be handed, and the one function that had drifted — a second
 * `progress()` that differed from `lib/progress.ts` in how it treated a zero
 * page count — is gone rather than reconciled. There is one progress rule.
 */

/**
 * §D10 — how many pages a book contributes to the total.
 *
 * A finished book counts its whole length, because `pagesRead` is where the
 * reader stopped *recording*, not where they stopped reading; someone who
 * finished a 400-page novel rarely typed 400 first. Where the page count is
 * missing the recorded figure is all there is. Wishlist and purchased books
 * contribute nothing: they have not been opened.
 */
export function pagesReadFor(book: Book): number {
  switch (book.status) {
    case "FINISHED":
      return book.totalPages ?? book.pagesRead;
    case "READING":
    case "ABANDONED":
      return book.pagesRead;
    default:
      return 0;
  }
}

/** §D11 — abandoning a book is a verdict, but it is not having read it. */
export function booksFinished(books: Book[]): number {
  return books.filter((book) => book.status === "FINISHED").length;
}

export function booksReading(books: Book[]): number {
  return books.filter((book) => book.status === "READING").length;
}

export function totalPagesRead(books: Book[]): number {
  return books.reduce((sum, book) => sum + pagesReadFor(book), 0);
}

/**
 * §D5 — averaged over rated books only. Counting the unrated ones as zero would
 * not be a lower average, it would be a wrong one: no rating is an absence, not
 * a verdict of nought.
 */
export function averageRating(books: Book[]): number | null {
  const rated = books.filter((book) => book.rating !== null);

  if (rated.length === 0) {
    return null;
  }

  return rated.reduce((sum, book) => sum + (book.rating ?? 0), 0) / rated.length;
}

/** §S8.2 — the shelf holds books you own. A wish is not on it. */
export function ownedBooks<T extends Book>(books: T[]): T[] {
  return books.filter((book) => book.status !== "WISHLIST");
}
