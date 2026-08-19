import type { WishlistSummary } from "@bookcsi/shared";
import type { TFunction } from "../i18n/catalog";

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
 *
 * **What §D44 removed.** This file used to assemble the sentence from a `noun()`
 * and a `verb()` of its own, because Romanian needs "de cărți" from 20 up and
 * these sentences put the noun somewhere the count is not ("7 din 11 cărți").
 * That was a fact about Romanian, not a structure English shares — English needs
 * neither the particle nor the verb agreement — so the catalog now holds four
 * whole sentences and `Intl.PluralRules` picks the form. Nothing here knows how
 * either language pluralises.
 */
export function coverage(
  { priced, count }: WishlistSummary,
  t: TFunction,
): string {
  if (priced === 0) {
    return t("wishlist.coverage.none");
  }

  if (priced === count) {
    return count === 1
      ? t("wishlist.coverage.onlyOne")
      : t("wishlist.coverage.all", { count });
  }

  return t("wishlist.coverage.some", { priced, count });
}
