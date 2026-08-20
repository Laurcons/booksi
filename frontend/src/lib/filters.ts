import type { ListBooksQuery } from "@bookcsi/shared";

/**
 * S5.3 — whether anything is currently narrowing the gallery.
 *
 * The empty state depends on it, and getting it wrong is user-visible: "încă
 * n-ai nicio carte" under three ticked filters is simply false, and its button
 * would not bring the filtered-out books back (§D29).
 *
 * An empty `status` list counts as no filter, matching what the page sends —
 * unticking the last box drops the parameter rather than asking the API for the
 * books whose status is one of none.
 *
 * Lives here rather than beside the component so that the filter panel stays a
 * file of components only, which is what fast refresh needs.
 */
export function isFiltered(query: ListBooksQuery): boolean {
  return (
    (query.status !== undefined && query.status.length > 0) ||
    // §D45 — category is a set now, and an empty one is no filter, matching the
    // status rule directly above (§D29).
    (query.category !== undefined && query.category.length > 0) ||
    query.favorite !== undefined ||
    // §D42 — a search narrows the list exactly like a filter does, so the
    // empty state has to read the same way. Without this, searching for
    // something the library does not have answers "you have no books yet",
    // which is false and whose button does not bring them back.
    isSearched(query)
  );
}

/**
 * Whether a search in particular is narrowing the list.
 *
 * Separate from `isFiltered` because two screens need to say something
 * different about the two: the wishlist's total is deliberately computed over
 * the whole wishlist (never over the search), so the line under it is about
 * `q` alone and must not appear merely because a status filter is on.
 *
 * An empty string counts as no search, matching what the pages send — the
 * parameter is dropped while the box is empty.
 */
export function isSearched(query: ListBooksQuery): boolean {
  return query.q !== undefined && query.q !== "";
}
