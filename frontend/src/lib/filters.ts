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
    query.genre !== undefined ||
    query.favorite !== undefined
  );
}
