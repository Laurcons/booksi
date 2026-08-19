import type { TFunction } from "../i18n/catalog";

/**
 * `YYYY-MM` as a reader sees it (§D21 for the identifier/text split, §D44 for
 * the two languages).
 *
 * Two shapes, because an axis and a tooltip have different room. Both live here
 * so the bar a user hovers is labelled the same way as the tick underneath it.
 *
 * The names come from the catalog rather than from `Intl.DateTimeFormat`, which
 * would also have given both languages. Two reasons to keep them written down:
 * the abbreviations are a design decision the design document owns (three
 * letters, and a trailing dot in Romanian where English has none), and the axis
 * needs them to be *stable* — `Intl`'s abbreviations vary between runtimes, so
 * a tick could change width on a different browser.
 */
export function monthLabel(month: string, t: TFunction): string {
  const [year, index] = parse(month);

  return `${t(`month.${index + 1}` as Parameters<TFunction>[0])} ${year}`;
}

/**
 * The axis tick, abbreviated — and carrying the year **only in January**.
 *
 * A dense multi-year series is the normal case here (§D31: the chart runs from
 * the first purchase to today), and a row of bare month names says nothing
 * about which year the reader is looking at. Repeating the year on all twelve
 * ticks is the other failure: the axis becomes a wall of digits. January is
 * where the year actually changes, so that is where it is worth writing.
 */
export function monthTick(month: string, t: TFunction): string {
  const [year, index] = parse(month);
  const short = t(`month.short.${index + 1}` as Parameters<TFunction>[0]);

  return index === 0 ? `${short} ${year}` : short;
}

function parse(month: string): [number, number] {
  const [year, position] = month.split("-").map(Number);

  return [year, position - 1];
}
