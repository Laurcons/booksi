/**
 * Money on screen. Two decimals always — a price is money whether or not it
 * ends in round lei, and a column of amounts only aligns if they all have the
 * same shape (docs/DESIGN.md asks for `tabular-nums` on exactly these).
 *
 * **Takes no locale, unlike `formatCount` (§D44.)** Two reasons, and the second
 * is the one that decides it:
 *
 * 1. There is nothing to disambiguate. `toFixed(2)` emits a dot decimal and no
 *    grouping at all, so "1234.50" cannot be read as another number the way a
 *    grouped count can.
 * 2. Switching the interface to English does not move the user to another
 *    country. The amounts in this database are lei, recorded by someone
 *    shopping in Romania, and rendering them "1,234.50" or "1.234,50" depending
 *    on which language the menus are in would be presenting the same money as
 *    though it were two different sums. Language is not region — which is also
 *    why `CURRENCY` below stays "lei" in both.
 */
export function formatMoney(value: number): string {
  return value.toFixed(2);
}

/**
 * The currency, written out rather than configured. S6.4 — choosing one — was
 * dropped (§D31), so this is a constant, not a setting: one place to change the
 * day it comes back, and nothing pretending to be user-editable meanwhile.
 */
export const CURRENCY = "lei";
