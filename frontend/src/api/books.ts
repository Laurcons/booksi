import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  Book,
  CreateBookInput,
  IsbnDuplicate,
  ListBooksQuery,
  UpdateBookInput,
  WishlistSummary,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

/**
 * Every mutation invalidates this prefix rather than a single sorted list:
 * the cache holds one entry per sort order, and a renamed book has to move in
 * all of them. The wishlist total (S3.3) hangs off the same prefix on purpose —
 * editing a price has to move the number above the table, not just the row.
 */
export const BOOKS_KEY = ["books"] as const;

/**
 * Exported for its own test. Spreading the query straight into
 * `URLSearchParams` looks equivalent and is not: an absent `status` (S3.1) is
 * the key present with value `undefined`, which serialises to the *string*
 * `"undefined"` — and the API validates that against the five statuses and
 * answers 400. The whole library would stop loading.
 */
export function listParams(query: ListBooksQuery): URLSearchParams {
  const params = new URLSearchParams({ sort: query.sort, order: query.order });

  if (query.status !== undefined) {
    params.set("status", query.status);
  }

  return params;
}

export function useBooks(query: ListBooksQuery) {
  return useQuery({
    queryKey: [...BOOKS_KEY, "list", query] as const,
    queryFn: () => apiFetch<Book[]>(`/books?${listParams(query)}`),
    // Re-sorting swaps the query key; without this the table would blank out
    // and jump on every header click.
    placeholderData: keepPreviousData,
  });
}

/** S3.3 — the total and the coverage that qualifies it, both from the server. */
export function useWishlistSummary() {
  return useQuery({
    queryKey: [...BOOKS_KEY, "wishlist-summary"] as const,
    queryFn: () => apiFetch<WishlistSummary>("/books/wishlist-summary"),
  });
}

/**
 * S3.4 — one click, no modal, no re-entered data. The status, the date and the
 * price are the server's to set together (§D6), which is why this is a route of
 * its own rather than a `PATCH` this hook assembles.
 */
export function usePurchaseBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Book>(`/books/${id}/purchase`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookInput) =>
      apiFetch<Book>("/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }),
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBookInput }) =>
      apiFetch<Book>(`/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/books/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }),
  });
}

/**
 * S1.1 / §D13 — a warning, never a block. The answer is advisory, so the query
 * stays disabled until there is something to look up and its failure is never
 * allowed to stop the form from saving.
 */
export function useIsbnDuplicates(isbn: string, excludeId?: string) {
  const trimmed = isbn.trim();

  return useQuery({
    queryKey: [...BOOKS_KEY, "isbn-duplicates", trimmed, excludeId] as const,
    queryFn: () => {
      const params = new URLSearchParams({ isbn: trimmed });
      if (excludeId !== undefined) {
        params.set("excludeId", excludeId);
      }
      return apiFetch<IsbnDuplicate[]>(`/books/isbn-duplicates?${params}`);
    },
    enabled: trimmed.length > 0,
    retry: false,
    staleTime: 60 * 1000,
  });
}
