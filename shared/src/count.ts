/**
 * A whole-number figure on screen, grouped: "4.210" rather than "4210".
 *
 * Romanian groups with a dot, which is also the decimal separator in English —
 * hence the explicit locale rather than the browser's, so a reader in a
 * different one still sees the app's own convention. Money has its own
 * formatter (`lib/money.ts`); this is for counts, which have no decimals to
 * pad.
 */
export function formatCount(value: number): string {
  return value.toLocaleString("ro-RO");
}
