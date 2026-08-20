import { z } from "zod";
import { type Locale } from "./locale.js";

/**
 * §D45 — the category taxonomy as the API serves it, and the helpers a client
 * uses to read it.
 *
 * The taxonomy left the type system for the database (docs/DECISIONS.md §D45),
 * so unlike `STATUS_LABELS` these types describe *fetched* data rather than a
 * compile-time constant. Two labels ride on every node, not one resolved to a
 * locale, so switching language stays a re-render and never a refetch — the
 * property the old `genreLabel(code, locale)` had, kept.
 *
 * A **group** is a shelving heading and is never attached to a book; only a
 * **leaf** category can be. That rule is the taxonomy's, enforced by the shape
 * of the tree (a book carries category *codes*, and every code names a leaf).
 */

/** One shelf. Both labels; `MANGA`'s two are the same English string (§D45). */
export const categorySchema = z.object({
  code: z.string(),
  labelRo: z.string(),
  labelEn: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

/** A heading and the shelves under it, both already in display order. */
export const categoryGroupSchema = z.object({
  code: z.string(),
  labelRo: z.string(),
  labelEn: z.string(),
  categories: z.array(categorySchema),
});
export type CategoryGroup = z.infer<typeof categoryGroupSchema>;

/** The whole tree, groups in display order — the payload of `GET /categories`. */
export const categoryTreeSchema = z.array(categoryGroupSchema);
export type CategoryTree = z.infer<typeof categoryTreeSchema>;

/**
 * A category code on a write or a filter. Shape only — that the code names a
 * category that actually exists is checked server-side against the taxonomy
 * table, because the valid set is data now and not knowable at parse time
 * (§D45).
 */
export const categoryCodeSchema = z.string().min(1);

/** The label for a node in one language — the successor to `genreLabel`. */
export function categoryLabel(
  node: { labelRo: string; labelEn: string },
  locale: Locale,
): string {
  return locale === "ro" ? node.labelRo : node.labelEn;
}

/** Every leaf across the tree, flattened — for a code→category lookup. */
export function flattenCategories(tree: CategoryTree): Category[] {
  return tree.flatMap((group) => group.categories);
}

/**
 * A `code → { category, group }` index over the tree, so a book's bare codes
 * can be resolved to a label (and its group) without walking the tree per code.
 */
export function categoryIndex(
  tree: CategoryTree,
): Map<string, { category: Category; group: CategoryGroup }> {
  const index = new Map<string, { category: Category; group: CategoryGroup }>();

  for (const group of tree) {
    for (const category of group.categories) {
      index.set(category.code, { category, group });
    }
  }

  return index;
}
