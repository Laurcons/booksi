import type { Genre } from "@bookcsi/shared";
import type { BookWithCover } from "./covers";

/**
 * S8.2 — the shelf's model layer: what a spine looks like, given a book.
 *
 * Separate from the component because it is arithmetic with rules behind it
 * (docs/DESIGN.md §Raftul names the thickness range and the fallback), and
 * arithmetic buried in JSX is arithmetic nobody checks.
 */

/**
 * Decorative, not a data palette. docs/DESIGN.md §Raftul is explicit that
 * nothing on the shelf encodes a readable value, so the dataviz rules do not
 * apply and these deliberately do not match the chart or status colours.
 *
 * One entry per genre, and the type is what enforces that: the previous copy of
 * this map lived beside a private eight-value `Genre` union and would have
 * returned `undefined` for the nine genres the real enum has had since §D19 —
 * an invisible gap until the day a book was filed under Poezie.
 */
export const GENRE_SPINE_COLOR: Record<Genre, string> = {
  FICTION: "#dccdae",
  SCIFI: "#a6c6da",
  FANTASY: "#c9b8e8",
  THRILLER: "#c2b3a6",
  ROMANCE: "#e9b9c6",
  HISTORICAL: "#bfcfa6",
  MEMOIR: "#eccba4",
  NONFICTION: "#b6c9c4",
  SELF_HELP: "#e0c9b1",
  BUSINESS: "#b3bcd0",
  SCIENCE: "#a8d0c6",
  PHILOSOPHY: "#cbc3b0",
  PSYCHOLOGY: "#d4b9d2",
  POETRY: "#e6c7b8",
  COMICS_MANGA: "#d8c98f",
  CHILDREN_YA: "#bcd9b8",
  OTHER: "#c6c0b8",
};

/** A book with no genre still needs a spine. */
const UNCLASSIFIED_SPINE = "#c6c0b8";

export function spineColor(genre: Genre | null): string {
  return genre === null ? UNCLASSIFIED_SPINE : GENRE_SPINE_COLOR[genre];
}

/** docs/DESIGN.md §Raftul: thickness comes from the page count. */
const MIN_WIDTH = 20;
const MAX_WIDTH = 56;
/** §D4 — a missing page count is the ordinary case, not an error. */
const DEFAULT_WIDTH = 32;
const TYPICAL_PAGES = 750;

export function spineWidth(totalPages: number | null): number {
  if (!totalPages) {
    return DEFAULT_WIDTH;
  }

  const scaled = MIN_WIDTH + (totalPages / TYPICAL_PAGES) * (MAX_WIDTH - MIN_WIDTH);

  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, scaled)));
}

/**
 * Deterministic jitter, so the shelf looks hand-stacked rather than generated —
 * and looks the *same* on every render, which `Math.random` would not.
 */
function jitter(id: string): number {
  let hash = 0;

  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 997;
  }

  return hash / 997;
}

export function spineHeight(book: Pick<BookWithCover, "id" | "totalPages">): number {
  const fromPages = ((book.totalPages ?? 320) / TYPICAL_PAGES) * 26;

  return Math.round(178 + fromPages + jitter(book.id) * 20);
}

/** Rows of spines, so the shelf can draw a plank under each. */
export const BOOKS_PER_ROW = 21;

export function shelfRows<T>(items: T[], size = BOOKS_PER_ROW): T[][] {
  const rows: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }

  return rows;
}
