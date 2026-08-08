import type { Book } from "./book.js";

/**
 * S2.2 — reading progress, derived here and nowhere stored.
 *
 * §D4 is the whole story: `totalPages` is missing often enough that its absence
 * is the normal case, not the exceptional one, so "no page count" is a first
 * class outcome rather than a division by null. Every surface that shows
 * progress — the table, the gallery card in S5.4, the dashboard in S8, and the
 * Kobo book list (§D37) — reads it from here, so the fallback wording cannot
 * drift between them.
 */

/** A book being read, whose progress can be measured at all. */
export interface ProgressInput {
  totalPages: number | null;
  pagesRead: number;
}

/**
 * `null` when there is nothing to divide by. Otherwise 0–1, **clamped**: the
 * API accepts a page number beyond `totalPages` on purpose (an edition's page
 * count is often somebody else's, §D7), and a bar that overflows its track
 * would be the reader's data looking like a bug.
 */
export function progressRatio(book: ProgressInput): number | null {
  if (book.totalPages === null || book.totalPages <= 0) {
    return null;
  }

  return Math.min(1, Math.max(0, book.pagesRead / book.totalPages));
}

export function progressPercent(book: ProgressInput): number | null {
  const ratio = progressRatio(book);

  return ratio === null ? null : Math.round(ratio * 100);
}

/**
 * The text beside the bar, in the two shapes S2.2 names: the percentage when
 * there is one, and a bare "pag. 143" when there is not — never a "?%", and
 * never a zero standing in for an unknown.
 */
export function progressLabel(book: ProgressInput): string {
  const percent = progressPercent(book);

  if (percent === null) {
    return `pag. ${book.pagesRead}`;
  }

  return `${percent}% — pag. ${book.pagesRead} din ${book.totalPages}`;
}

/** The compact form for a table cell, where the long label does not fit. */
export function progressShortLabel(book: ProgressInput): string {
  if (book.totalPages === null || book.totalPages <= 0) {
    return `pag. ${book.pagesRead}`;
  }

  return `${book.pagesRead}/${book.totalPages}`;
}

/**
 * docs/DESIGN.md: the bar belongs to books being read. Elsewhere it would be
 * noise — a finished book is at 100% by definition, and a wishlist entry has
 * nothing to show.
 */
export function showsProgressBar(book: Book): boolean {
  return book.status === "READING";
}
