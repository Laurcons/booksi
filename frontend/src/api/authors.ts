import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  Author,
  AuthorDetail,
  AuthorSuggestion,
  CreateAuthorInput,
  DeleteAuthorResult,
  UpdateAuthorInput,
} from "@bookcsi/shared";
import { apiFetch } from "../lib/api";
import { BOOKS_KEY } from "./books";
import { CHALLENGES_KEY } from "./challenges";

/**
 * §D51 — the author entity's client side.
 *
 * Deliberately **not** cached the way `/categories` is. The taxonomy is a
 * controlled vocabulary that changes only by migration, so it gets
 * `staleTime: Infinity` and is fetched once per session; an author list is the
 * reader's own mutable data — created and deleted from the picker while a form
 * is open — so it is an ordinary query that refetches and is invalidated on
 * write.
 */
export const AUTHORS_KEY = ["authors"] as const;

/** One author's own entry, so a `PATCH` can invalidate exactly it. */
export const authorKey = (id: string) => [...AUTHORS_KEY, id] as const;

/**
 * The picker's dropdown. `q` is already debounced by the caller.
 *
 * `keepPreviousData` is what stops the list flickering to empty between
 * keystrokes: without it every new `q` is a fresh cache entry with no data, the
 * dropdown unmounts its rows, and typing a name feels like the suggestions are
 * fighting back. The same treatment `useBooks` gives the search box.
 *
 * An empty `q` is not a special case here — the API answers it with the whole
 * list (see `listAuthorsQuerySchema`), which is what makes the dropdown useful
 * for finding an author to delete.
 */
export function useAuthors(q: string) {
  const trimmed = q.trim();

  return useQuery({
    queryKey: [...AUTHORS_KEY, "list", trimmed] as const,
    queryFn: () =>
      apiFetch<AuthorSuggestion[]>(
        trimmed === "" ? "/authors" : `/authors?q=${encodeURIComponent(trimmed)}`,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * One author in full — the biography included.
 *
 * Only needed when the form **switches** to a different author: opening it
 * already has the biography, because the book response carries its author whole
 * (§D51). `enabled` is therefore the normal state for this hook, not an
 * afterthought: it is off whenever no author is selected.
 */
export function useAuthor(id: string | null) {
  return useQuery({
    // `AuthorDetail`, not `Author`: this route carries the `bookCount` the
    // form's shared-scope line needs, which is deliberately absent from the
    // author embedded in a book response (§D51).
    queryKey: authorKey(id ?? ""),
    queryFn: () => apiFetch<AuthorDetail>(`/authors/${id ?? ""}`),
    enabled: id !== null,
  });
}

/**
 * `POST /authors` — the deliberate creation.
 *
 * Fires the moment the reader clicks "create this author", **not** on the book
 * form's Save. That is the decision §D51 settled and it is worth restating
 * here, because the alternative is tempting: staging the creation until Save
 * would mean nothing persists if the reader cancels. It was rejected because
 * the error has nowhere good to go — a name rejected at Save time is reported
 * three tabs and one click away from the box it was typed into, whereas the
 * moment of confirming the name is exactly where a problem with the name
 * should surface.
 *
 * The cost is real and accepted: cancelling a book form can leave an author
 * with no books. Which is also why the delete confirmation says nothing when
 * the count is zero — removing such an author is one click from the same
 * dropdown that made it.
 */
export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAuthorInput) =>
      apiFetch<Author>("/authors", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTHORS_KEY });
    },
  });
}

/**
 * `PATCH /authors/:id` — the biography.
 *
 * Invalidates the **books** as well as the author, and that is the whole shape
 * of §D51 in one line: a biography is not a field of the book being edited, so
 * saving it has to move every book that carries this author. The book profile
 * behind the dialog is showing that prose, and the book responses embed it.
 */
export function useUpdateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAuthorInput }) =>
      apiFetch<AuthorDetail>(`/authors/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (author) => {
      queryClient.setQueryData(authorKey(author.id), author);
      void queryClient.invalidateQueries({ queryKey: AUTHORS_KEY });
      void queryClient.invalidateQueries({ queryKey: BOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
    },
  });
}

/**
 * `DELETE /authors/:id` — and the books it leaves behind.
 *
 * **`BOOKS_KEY` is not optional here.** Deleting an author mutates books the
 * request never named (`onDelete: SetNull`), so a cache that only dropped the
 * author list would leave the table behind the dialog showing a name that no
 * longer exists anywhere — the kind of staleness that reads as data loss.
 * `CHALLENGES_KEY` for the same reason `useUpdateBook` invalidates it: a
 * challenge embeds full book rows.
 */
export function useDeleteAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteAuthorResult>(`/authors/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: authorKey(id) });
      void queryClient.invalidateQueries({ queryKey: AUTHORS_KEY });
      void queryClient.invalidateQueries({ queryKey: BOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: CHALLENGES_KEY });
    },
  });
}
