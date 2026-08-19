import { type Locale } from "./locale.js";

/**
 * A whole-number figure on screen, grouped: "4.210" in Romanian, "4,210" in
 * English.
 *
 * The separator is the whole reason this takes a locale (§D44). It used to pin
 * `ro-RO` deliberately, so that a reader whose browser was set elsewhere still
 * saw the app's own convention — sound while the app had one convention, and
 * exactly backwards once it has two: Romanian groups with a dot, which is
 * English's *decimal* separator, so "4.210" read by an English reader is four
 * and a bit rather than four thousand. The same string, two numbers.
 *
 * Money has its own formatter (`money.ts`) and does not take a locale — see the
 * note there for why.
 */
export function formatCount(value: number, locale: Locale): string {
  return value.toLocaleString(locale);
}
