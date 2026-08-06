import type { Book } from "./types";

/**
 * Derived values are never stored — they are computed from the books.
 * The page-count aggregation rule is the one fixed in docs/DECISIONS.md §D10,
 * and it lives here only so the mock has a single source for it.
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

export function booksFinished(books: Book[]): number {
  // Abandoned books do not count as read — §D11
  return books.filter((b) => b.status === "FINISHED").length;
}

export function booksReading(books: Book[]): number {
  return books.filter((b) => b.status === "READING").length;
}

export function totalPagesRead(books: Book[]): number {
  return books.reduce((sum, b) => sum + pagesReadFor(b), 0);
}

/** Averaged over rated books only — unrated ones would drag it down. §D5 */
export function averageRating(books: Book[]): number | null {
  const rated = books.filter((b) => b.rating !== null);
  if (rated.length === 0) return null;
  return rated.reduce((sum, b) => sum + (b.rating ?? 0), 0) / rated.length;
}

/** Progress is derived; undefined when the page count is missing. §D4 */
export function progress(book: Book): number | null {
  if (!book.totalPages) return null;
  return Math.min(1, book.pagesRead / book.totalPages);
}

/** Books the reader owns. The wishlist never appears on the shelf. §S8.2 */
export function ownedBooks(books: Book[]): Book[] {
  return books.filter((b) => b.status !== "WISHLIST");
}
