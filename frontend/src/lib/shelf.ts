import type { Book, Genre } from "@bookcsi/shared";

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
  AUDIOBOOKS: "#deb5b5",
  CULINARY: "#debdb5",
  ART_ARCHITECTURE: "#dec6b5",
  ENCYCLOPEDIAS: "#deceb5",
  BIOGRAPHIES: "#ded7b5",
  LINGUISTICS_DICTIONARIES: "#dcdeb5",
  ROMANIAN_MAGAZINES: "#d4deb5",
  FOREIGN_LANGUAGES: "#cbdeb5",
  POETRY_THEATRE: "#c3deb5",
  FICTION: "#bbdeb5",
  COMICS: "#b5deb8",
  TRAVEL_GUIDES: "#b5dec1",
  HISTORY: "#b5dec9",
  RELIGION: "#b5ded1",
  PHILOSOPHY: "#b5deda",
  PSYCHOLOGY: "#b5dade",
  SOCIAL_SCIENCES_POLITICS: "#b5d1de",
  MARKETING_COMMUNICATION: "#b5c9de",
  BUSINESS_ECONOMY: "#b5c1de",
  LAW: "#b5b8de",
  MEDICINE: "#bbb5de",
  EXACT_SCIENCES_MATH: "#c3b5de",
  NATURE_ENVIRONMENT: "#cbb5de",
  TECHNOLOGY: "#d4b5de",
  COMPUTERS_INTERNET: "#dcb5de",
  HEALTH_SELF_DEVELOPMENT: "#deb5d7",
  LIFESTYLE_SPORT_LEISURE: "#deb5ce",
  ROMANIA: "#deb5c6",
  EDUCATIONAL_SOFTWARE: "#deb5bd",
};

/** A book with no genre still needs a spine. */
const UNCLASSIFIED_SPINE = "#c6c0b8";

export function spineColor(genre: Genre | null): string {
  return genre === null ? UNCLASSIFIED_SPINE : GENRE_SPINE_COLOR[genre];
}

/**
 * docs/DESIGN.md §Raftul: thickness comes from the page count, between 14px and
 * 44px, with 24px for a book whose length nobody entered.
 *
 * §D33 is about the mapping rather than the range. Scaling proportionally from
 * zero pages — which is what this did, and what the spec implied — puts a
 * 200-page novel at 22px and leaves the bottom of the range unreachable, since
 * a book with no page count takes the default instead. Anchoring the ramp at a
 * thin-but-real 80 pages and saturating at 900 makes both ends belong to books
 * that exist, which is also what keeps `SPINE_TITLE_WIDTH` from being a
 * condition that is always true.
 */
const MIN_WIDTH = 14;
const MAX_WIDTH = 44;
/** §D4 — a missing page count is the ordinary case, not an error. */
const DEFAULT_WIDTH = 24;
const THINNEST_PAGES = 80;
const THICKEST_PAGES = 900;

/**
 * Above this, the spine is wide enough to set the title in. Exported because
 * the component draws the text and this file owns the geometry — and because a
 * threshold that lives beside the range it has to fall inside is a threshold
 * somebody will notice when the range moves (§D33).
 */
export const SPINE_TITLE_WIDTH = 20;

export function spineWidth(totalPages: number | null): number {
  if (!totalPages) {
    return DEFAULT_WIDTH;
  }

  const span = (totalPages - THINNEST_PAGES) / (THICKEST_PAGES - THINNEST_PAGES);
  const scaled = MIN_WIDTH + span * (MAX_WIDTH - MIN_WIDTH);

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

export function spineHeight(book: Pick<Book, "id" | "totalPages">): number {
  const fromPages = ((book.totalPages ?? 320) / THICKEST_PAGES) * 26;

  return Math.round(178 + fromPages + jitter(book.id) * 20);
}

/** The gap between two spines, in the units the rows are measured in. */
const SPINE_GAP = 3;

/**
 * How wide a plank is. The shelf scrolls sideways rather than reflowing, so
 * this is a fixed measure and not a reading of the viewport.
 */
export const ROW_WIDTH = 1000;

/**
 * Rows of spines, so the shelf can draw a plank under each — packed **by width,
 * not by count**.
 *
 * A fixed number per row was the obvious version and is wrong at both ends of
 * §D33's range: twenty-one thin paperbacks leave a third of the plank bare,
 * while twenty-one doorstops run off it. Filling each row until the next spine
 * would not fit is how a real shelf fills, and it cannot overflow by
 * construction.
 *
 * A book wider than an empty row still gets its own row rather than being
 * dropped — impossible with the current range, and a silently vanishing book
 * is a worse failure than a slightly long plank.
 */
export function shelfRows<T>(
  items: T[],
  width: (item: T) => number,
  budget = ROW_WIDTH,
): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;

  for (const item of items) {
    const cost = width(item) + SPINE_GAP;

    if (row.length > 0 && used + cost > budget) {
      rows.push(row);
      row = [];
      used = 0;
    }

    row.push(item);
    used += cost;
  }

  if (row.length > 0) {
    rows.push(row);
  }

  return rows;
}

/**
 * S8.2's two orders: the day a book was bought, and the alphabet.
 *
 * Both are server-side sorts on the listing route (§D29) rather than a
 * `sort()` here — the same rule that put the gallery's filters in SQL. Newest
 * purchase first, which is every other default in the app and, on MariaDB,
 * queues the books with no purchase date at the far end instead of opening the
 * shelf with a block of them.
 */
export const SHELF_ORDERS = {
  purchased: { sort: "purchasedOn", order: "desc" },
  alphabetical: { sort: "title", order: "asc" },
} as const;

export type ShelfOrder = keyof typeof SHELF_ORDERS;
