import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  normalizeIsbn,
  type BookSuggestion,
  type CoverRef,
  type OpenLibraryResult,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";
import { resizeCover } from "../lib/resize-cover";
import { BOOKS_KEY } from "./books";

/**
 * Sprint 4, client side. Every call goes to our own API, which is the whole of
 * ARCHITECTURE.md §Open Library: `openlibrary.org` never appears in this
 * workspace, and the day it does the rule has been broken.
 */
const OPEN_LIBRARY_KEY = ["openlibrary"] as const;

/** S4.1 — the search API asks for two characters before it will answer. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * S4.1. The debounce is the *caller's* job — this hook takes an already-settled
 * value, so that the 300ms lives next to the input it belongs to rather than
 * inside a data hook where nobody would look for it.
 *
 * `retry: false` matters more than usual here. A failed search is a message in
 * a dropdown, not a broken page, and the degradation criterion says the manual
 * form must stay usable — three silent retries against a service that is
 * already known to be down is the opposite of getting out of the user's way.
 */
export function useOpenLibrarySearch(q: string) {
  const trimmed = q.trim();

  return useQuery({
    queryKey: [...OPEN_LIBRARY_KEY, "search", trimmed] as const,
    queryFn: () =>
      apiFetch<OpenLibraryResult[]>(
        `/openlibrary/search?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    retry: false,
    // Typing "dun", "dune", then backspacing is one search, not three: the
    // earlier answers are still good.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * S4.1 / §D7 — the second half of picking a result: the work the user
 * recognised, resolved into the edition the fields actually come from.
 *
 * A mutation rather than a query because it is an action with a moment, not a
 * fact about the current state — and because its result is poured into a form
 * once, not re-read on every render.
 */
export function useEditionSuggestion() {
  return useMutation({
    mutationFn: (editionKey: string) =>
      apiFetch<BookSuggestion>(`/openlibrary/editions/${editionKey}`),
  });
}

/**
 * S4.2 — whether an ISBN is worth asking about.
 *
 * Ten or thirteen digits once the punctuation is gone, matching the API's own
 * rule. Checked here so that typing the first four digits of an ISBN does not
 * produce four requests and four "not found" messages on the way to a complete
 * one.
 */
export function isLookupableIsbn(isbn: string): boolean {
  return [10, 13].includes(normalizeIsbn(isbn).length);
}

/**
 * S4.2 — the fill that follows a complete ISBN.
 *
 * `enabled` is where the ordering the story asks for is actually enforced:
 * nothing is looked up until the duplicate check has come back. "Ai deja
 * această carte" is the more important of the two answers and has to be on
 * screen first; the fill is a convenience that arrives after it.
 *
 * A 404 is an ordinary outcome — most ISBNs are not in Open Library — so it is
 * not retried, and the component says so plainly rather than treating it as an
 * error.
 */
export function useIsbnSuggestion(isbn: string, ready: boolean) {
  const trimmed = isbn.trim();

  return useQuery({
    queryKey: [...OPEN_LIBRARY_KEY, "isbn", normalizeIsbn(trimmed)] as const,
    queryFn: () =>
      apiFetch<BookSuggestion>(`/openlibrary/isbn/${encodeURIComponent(trimmed)}`),
    enabled: ready && isLookupableIsbn(trimmed),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The resize-then-PUT job itself, apart from the mutation wrapper below.
 *
 * Split out so the add-book dialog can run it once a freshly created book's id
 * is known, outside of any hook whose `bookId` is fixed at render time.
 */
export async function uploadCoverImage(bookId: string, file: File): Promise<CoverRef> {
  const image = await resizeCover(file);

  return apiFetch<CoverRef>(`/books/${bookId}/cover`, {
    method: "PUT",
    headers: { "Content-Type": image.type },
    body: image,
  });
}

/**
 * S4.3 — the manual upload, while editing.
 *
 * The resize happens inside the mutation rather than at the input, so that
 * "uploading" covers the whole job the user is waiting on: a 4MB photograph
 * takes a moment to decode and re-encode, and a spinner that only starts once
 * the network does would sit still through the slow part.
 *
 * Invalidates the book list because `coverUrl` lives on the book — and the URL
 * is the thing that changed, since the image behind the old one is cached for
 * a year (§D26).
 */
export function useUploadCover(bookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadCoverImage(bookId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }),
  });
}
