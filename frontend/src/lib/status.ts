import type { Status } from "@bookcsi/shared";

/** docs/DESIGN.md §Statusuri — reserved, never reused as chart series. */
export const STATUS_COLOR: Record<Status, string> = {
  WISHLIST: "var(--color-status-wishlist)",
  PURCHASED: "var(--color-status-purchased)",
  READING: "var(--color-status-reading)",
  FINISHED: "var(--color-status-finished)",
  ABANDONED: "var(--color-status-abandoned)",
};

/**
 * S1.4 — the happy path, and *only* the happy path. The row's primary button
 * proposes this one step; every other transition stays reachable through the
 * edit form, because §D12 is explicit that the flow is a suggestion and not a
 * constraint. Without free transitions an existing shelf could not be typed in
 * at all.
 *
 * `ABANDONED` is deliberately not proposed anywhere: abandoning a book is a
 * decision, not the natural next step of reading one.
 */
export const NEXT_STATUS: Record<Status, Status | null> = {
  WISHLIST: "PURCHASED",
  PURCHASED: "READING",
  READING: "FINISHED",
  FINISHED: null,
  ABANDONED: null,
};

export const NEXT_STATUS_LABEL: Record<Status, string> = {
  WISHLIST: "Am cumpărat-o",
  PURCHASED: "Încep s-o citesc",
  READING: "Am terminat-o",
  FINISHED: "",
  ABANDONED: "",
};
