import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
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
 * One author in full, for the tab to **display**.
 *
 * The only thing read off it is the `bookCount` in the shared-scope line — the
 * biography reaches the form through `fetchAuthor` below instead, and the note
 * there says why that separation matters. `enabled` is the normal state for
 * this hook rather than an afterthought: it is off whenever no author is
 * selected.
 */
export function useAuthor(id: string | null) {
  return useQuery({ ...authorQuery(id ?? ""), enabled: id !== null });
}

/**
 * One author's route, in one place.
 *
 * `AuthorDetail`, not `Author`: it carries the `bookCount` the form's
 * shared-scope line needs, which is deliberately absent from the author
 * embedded in a book response (§D51). Shared by the hook above and the
 * imperative fetch below so that both are the same cache entry — a switch of
 * author costs one request between the two of them, not two.
 */
const authorQuery = (id: string) => ({
  queryKey: authorKey(id),
  queryFn: () => apiFetch<AuthorDetail>(`/authors/${id}`),
});

/**
 * The same author, fetched once because something happened — not subscribed to.
 *
 * §D51 — this is how the biography reaches the form, and the distinction from
 * `useAuthor` is the whole reason it exists. The text is poured in by the
 * **event that changes the author**, because that is the only moment it is
 * true. It used to be poured by an effect watching `useAuthor`, which fires on
 * every *mount* — and `AuthorTab` mounts on every visit to the tab, so leaving
 * the tab and coming back overwrote whatever the reader had typed with the
 * stored version (`.claude/mistakes.md`).
 *
 * `useAuthor` therefore no longer feeds the form at all: it is display data for
 * the shared-scope line, and a refetch, a window regaining focus or a
 * `setQueryData` from a `PATCH` can no longer reach a field somebody is typing
 * in.
 */
export function fetchAuthor(queryClient: QueryClient, id: string) {
  return queryClient.fetchQuery(authorQuery(id));
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
