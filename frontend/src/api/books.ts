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
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

/**
 * Every mutation invalidates this prefix rather than a single sorted list:
 * the cache holds one entry per sort order, and a renamed book has to move in
 * all of them.
 */
export const BOOKS_KEY = ["books"] as const;

export function useBooks(query: ListBooksQuery) {
  return useQuery({
    queryKey: [...BOOKS_KEY, "list", query] as const,
    queryFn: () =>
      apiFetch<Book[]>(`/books?${new URLSearchParams({ ...query })}`),
    // Re-sorting swaps the query key; without this the table would blank out
    // and jump on every header click.
    placeholderData: keepPreviousData,
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
