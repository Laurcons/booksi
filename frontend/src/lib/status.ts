import type { Status } from "@bookcsi/shared";
import type { MessageKey } from "../i18n/catalog";

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

/**
 * The button's words, as a catalog key rather than a sentence (§D44).
 *
 * `null` exactly where `NEXT_STATUS` is null, so the two cannot disagree about
 * whether a step exists — which the old shape could, since it spelled "no next
 * step" as `""` and left a caller free to render an empty button.
 */
export const NEXT_STATUS_KEY: Record<Status, MessageKey | null> = {
  WISHLIST: "status.next.purchased",
  PURCHASED: "status.next.reading",
  READING: "status.next.finished",
  FINISHED: null,
  ABANDONED: null,
};
