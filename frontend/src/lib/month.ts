/**
 * `YYYY-MM` as a reader sees it (§D21 — identifiers in English, screen text in
 * Romanian).
 *
 * Two shapes, because an axis and a tooltip have different room. Both live here
 * so the bar a user hovers is labelled the same way as the tick underneath it.
 */

const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

const SHORT = [
  "ian.",
  "feb.",
  "mar.",
  "apr.",
  "mai",
  "iun.",
  "iul.",
  "aug.",
  "sep.",
  "oct.",
  "nov.",
  "dec.",
];

/** The tooltip's label: "august 2026". */
export function monthLabel(month: string): string {
  const [year, index] = parse(month);

  return `${MONTHS[index]} ${year}`;
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
export function monthTick(month: string): string {
  const [year, index] = parse(month);

  return index === 0 ? `ian. ${year}` : SHORT[index];
}

function parse(month: string): [number, number] {
  const [year, position] = month.split("-").map(Number);

  return [year, position - 1];
}
