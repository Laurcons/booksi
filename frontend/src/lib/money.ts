/**
 * Money on screen. Two decimals always — a price is money whether or not it
 * ends in round lei, and a column of amounts only aligns if they all have the
 * same shape (docs/DESIGN.md asks for `tabular-nums` on exactly these).
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
