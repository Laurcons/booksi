import type { WishlistSummary } from "@bookcsi/shared";

/**
 * S3.3 — the sentence under the wishlist total, in the three shapes it can
 * take.
 *
 * The wording is the requirement, not decoration: a total summed over the books
 * that have an estimate reads, on its own, as the price of the whole list, and
 * it is wrong by however many books were left blank. "7 din 11 cărți au preț
 * estimat" is written into the story itself.
 *
 * It lives here rather than beside the component so that file exports only its
 * component — a module that mixes the two breaks React's fast refresh.
 */
export function coverage({ priced, count }: WishlistSummary): string {
  if (priced === 0) {
    return "Nicio carte n-are încă un preț estimat.";
  }

  if (priced === count) {
    return count === 1
      ? "Singura carte din wishlist are preț estimat."
      : `Toate cele ${count} ${noun(count)} au preț estimat.`;
  }

  return `${priced} din ${count} ${noun(count)} ${verb(count)} preț estimat.`;
}

/**
 * Romanian needs "de" from 20 up — `plural()` knows the rule but bakes the
 * count into the string it returns, and these sentences put the noun somewhere
 * else ("7 din 11 cărți", not "11 cărți").
 */
function noun(count: number): string {
  if (count === 1) {
    return "carte";
  }

  const lastTwo = count % 100;

  return lastTwo === 0 || lastTwo >= 20 ? "de cărți" : "cărți";
}

function verb(count: number): string {
  return count === 1 ? "are" : "au";
}
