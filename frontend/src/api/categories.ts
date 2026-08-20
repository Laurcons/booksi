import { useQuery } from "@tanstack/react-query";
import {
  categoryIndex,
  type Category,
  type CategoryGroup,
  type CategoryTree,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

/**
 * §D45 — the category taxonomy, fetched once and held.
 *
 * A controlled vocabulary that changes only by migration (no admin story), so
 * it is cached hard: `staleTime: Infinity` means the app fetches it once per
 * session and never refetches on focus or remount. Both labels ride on every
 * node, so switching language is a re-render, never a network trip (§D45).
 */
export const CATEGORIES_KEY = ["categories"] as const;

export function useCategoryTree() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => apiFetch<CategoryTree>("/categories"),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * The tree plus a `code → { category, group }` index, for the surfaces that
 * resolve a book's bare category codes to labels (the shelf, the profile, the
 * chips). The index is memoised by react-query's stable data reference — the
 * same tree object across renders, so `categoryIndex` runs once per fetch.
 */
export function useCategoryLookup(): {
  tree: CategoryTree;
  index: Map<string, { category: Category; group: CategoryGroup }>;
  isLoading: boolean;
} {
  const { data, isLoading } = useCategoryTree();
  // Defensive against a not-yet-loaded (`undefined`) or malformed response:
  // the index and every caller assume an array.
  const tree = Array.isArray(data) ? data : [];

  return { tree, index: categoryIndex(tree), isLoading };
}
