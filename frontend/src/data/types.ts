/**
 * Mirrors the data model in docs/DECISIONS.md, trimmed to what the
 * dashboard mock actually needs.
 */

export type Status =
  | "WISHLIST"
  | "PURCHASED"
  | "READING"
  | "FINISHED"
  | "ABANDONED";

export type Genre =
  | "FICTION"
  | "SCIFI"
  | "FANTASY"
  | "THRILLER"
  | "ROMANCE"
  | "HISTORICAL"
  | "MEMOIR"
  | "NONFICTION";

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: Genre;
  /** Missing on many Open Library editions — see §D4 */
  totalPages: number | null;
  pagesRead: number;
  status: Status;
  rating: number | null;
  favorite: boolean;
  cover: string | null;
  finishedOn?: string;
}

/** UI copy is Romanian; identifiers are not. */
export const STATUS_LABEL: Record<Status, string> = {
  WISHLIST: "Wishlist",
  PURCHASED: "Cumpărat",
  READING: "Citesc",
  FINISHED: "Terminat",
  ABANDONED: "Abandonat",
};

export const GENRE_LABEL: Record<Genre, string> = {
  FICTION: "Ficțiune",
  SCIFI: "SF",
  FANTASY: "Fantasy",
  THRILLER: "Thriller / Mister",
  ROMANCE: "Romance",
  HISTORICAL: "Roman istoric",
  MEMOIR: "Biografie / Memorii",
  NONFICTION: "Non-ficțiune",
};

export const STATUS_COLOR: Record<Status, string> = {
  WISHLIST: "var(--color-status-wishlist)",
  PURCHASED: "var(--color-status-purchased)",
  READING: "var(--color-status-reading)",
  FINISHED: "var(--color-status-finished)",
  ABANDONED: "var(--color-status-abandoned)",
};

/**
 * Decorative pastel ramp for the shelf spines. Deliberately separate from the
 * chart palette: nothing on the shelf encodes a readable value, so the dataviz
 * rules do not apply here. See docs/DESIGN.md §Raftul.
 */
export const GENRE_SPINE_COLOR: Record<Genre, string> = {
  FANTASY: "#c9b8e8",
  SCIFI: "#a6c6da",
  ROMANCE: "#e9b9c6",
  FICTION: "#dccdae",
  HISTORICAL: "#bfcfa6",
  THRILLER: "#c2b3a6",
  MEMOIR: "#eccba4",
  NONFICTION: "#b6c9c4",
};
