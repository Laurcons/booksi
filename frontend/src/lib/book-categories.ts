import { categoryLabel, type Category, type CategoryGroup, type Locale } from "@bookcsi/shared";

/**
 * §D45 — resolving a book's bare category codes against the fetched taxonomy.
 *
 * Books carry codes only (a small response, labels in one place); these turn
 * them into what the UI shows, using the `code → { category, group }` index the
 * taxonomy query already builds (`useCategoryLookup`). A code not found in the
 * tree is skipped rather than shown raw — the one way that happens is a book
 * tagged just before a taxonomy migration removed the shelf, and a bare
 * `FICTION__SF` on screen helps nobody.
 */
type CategoryIndex = Map<string, { category: Category; group: CategoryGroup }>;

/**
 * The group code to colour a book's spine by — its first resolvable category's
 * group. Decorative, so "first" (insertion order) is fine; `null` for a book on
 * no shelf, which draws the unclassified spine.
 */
export function bookGroupCode(codes: string[], index: CategoryIndex): string | null {
  for (const code of codes) {
    const hit = index.get(code);

    if (hit) {
      return hit.group.code;
    }
  }

  return null;
}

/** A book's category labels in the current language, unknown codes dropped. */
export function bookCategoryLabels(
  codes: string[],
  index: CategoryIndex,
  locale: Locale,
): string[] {
  return codes
    .map((code) => index.get(code))
    .filter((hit): hit is NonNullable<typeof hit> => hit !== undefined)
    .map((hit) => categoryLabel(hit.category, locale));
}
