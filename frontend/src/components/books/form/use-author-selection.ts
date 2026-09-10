import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { Author, AuthorSuggestion, CreateBookInput } from "@bookcsi/shared";
import { fetchAuthor, useCreateAuthor, useDeleteAuthor } from "../../../api/authors";
import { errorMessage } from "../../../lib/api";
import { useT } from "../../../i18n/locale-context";
import { useToast } from "../../toast/toast-context";
import type { PickedAuthor } from "../AuthorPicker";
import type { BookFormValues } from "./schema";

/**
 * §D51 — choosing the book's author, and everything that follows from it.
 *
 * A hook rather than code inside a tab, for a reason that is structural: the
 * author field is on **two** tabs. It belongs on Carte, where the reader is
 * already typing the title and the author is the next thing they know about the
 * book; and it belongs on Autor, where realising you are reading the wrong
 * person's biography is exactly the moment you want the control under your
 * hand. Both copies have to behave identically, which means the behaviour
 * cannot live in either of them.
 *
 * Only one tab is mounted at a time, so there are never two live pickers —
 * `AuthorPicker` re-seeds its visible text from `value` when it mounts, so
 * whichever copy the reader arrives at comes up showing the current selection.
 *
 * The name lives here as state because it is **display** data: the form holds
 * an id (that is what the API takes), the box shows a name, and putting the
 * name through validation would let a value nobody can see or correct block
 * `handleSubmit` — the mistake `schema.ts` records at length.
 */
export interface AuthorSelection {
  /** The selection, as `AuthorPicker` takes it. */
  value: PickedAuthor | null;
  /** The reader chose one, or cleared the field. */
  pick: (author: PickedAuthor | null) => void;
  /** The reader confirmed a name that is not an author yet (§D51). */
  create: (name: string) => Promise<PickedAuthor | null>;
  /** The reader deleted an author — which may or may not be this book's. */
  remove: (author: AuthorSuggestion) => Promise<void>;
  /**
   * Take an author the caller already holds in full, without a round trip.
   *
   * For the Open Library fill, which resolves a catalogue's spelling to a row
   * and so has the whole thing — biography included — in hand.
   */
  adopt: (author: Author) => void;
}

export function useAuthorSelection(
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>,
  initialName: string,
): AuthorSelection {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const createAuthor = useCreateAuthor();
  const deleteAuthor = useDeleteAuthor();

  const { watch, setValue, getValues } = form;

  const [name, setName] = useState(initialName);
  const id = watch("authorId");

  /**
   * Pour an author's stored biography into the form.
   *
   * **Called from the event that changed the author, never from an effect**, and
   * that is the fix for the bug this hook was extracted during: an effect that
   * seeds a form field runs again on every mount, `AuthorTab` mounts on every
   * visit to the tab, and so switching to Carte and back replaced whatever the
   * reader had typed with the stored text. Worse than it sounds, because
   * `setValue` with no options leaves `dirtyFields` alone — the tab kept its dot
   * for the change it had just erased, and Save wrote the old text back over
   * itself. Seeding from the event happens once, when it is true.
   *
   * `setValue` without `shouldDirty`: the text arriving is what is *stored* for
   * this author, so a Save must not write it back, and the tab must not grow a
   * dot for a change nobody made. (`resetField` would say that more precisely
   * and cannot be used — it is a silent no-op on a field react-hook-form has
   * not registered, and the biography's textarea is only rendered once an
   * author is selected, which is the very state this call is establishing.)
   */
  const load = useCallback(
    async (authorId: string) => {
      const detail = await fetchAuthor(queryClient, authorId).catch(() => null);

      if (detail === null) {
        // Said out loud rather than swallowed: an empty box for an author who
        // has a biography invites the reader to write over prose they never
        // saw, and this is the only warning they would get.
        toast.show("error", t("author.biographyFailed"));
        return;
      }

      // A later pick won the race — this response is about an author nobody is
      // looking at any more. Read off the form itself, which is the authority
      // on what is currently selected.
      if (getValues("authorId") !== authorId) {
        return;
      }

      setValue("authorBiography", detail.biography ?? "");
    },
    [getValues, queryClient, setValue, t, toast],
  );

  const pick = useCallback(
    (author: PickedAuthor | null) => {
      // `shouldDirty` on the id, because that *is* a change to the book. The
      // name travels quietly alongside it: it is display only, and marking it
      // would put a second dot's worth of meaning on one decision.
      setValue("authorId", author?.id ?? null, { shouldDirty: true });
      setName(author?.name ?? "");

      /*
        Emptied immediately, before the new author's text arrives — so the box
        never shows one person's biography under another person's name. Cleared
        without dirtying, so a Save between the two moments cannot `PATCH` a
        blank over what is stored.
      */
      setValue("authorBiography", "");

      if (author !== null) {
        void load(author.id);
      }
    },
    [load, setValue],
  );

  const adopt = useCallback(
    (author: Author) => {
      setValue("authorId", author.id, { shouldDirty: true });
      setName(author.name);
      setValue("authorBiography", author.biography ?? "");
    },
    [setValue],
  );

  const create = useCallback(
    async (typed: string): Promise<PickedAuthor | null> => {
      try {
        const author = await createAuthor.mutateAsync({ name: typed });
        toast.show("info", t("author.created", { name: author.name }));
        return author;
      } catch (error) {
        // Reported where the name was confirmed, which is the reason creation
        // is immediate rather than deferred to Save (§D51).
        toast.show("error", errorMessage(error, t("author.createFailed")));
        return null;
      }
    },
    [createAuthor, t, toast],
  );

  const remove = useCallback(
    async (author: AuthorSuggestion) => {
      try {
        const { booksAffected } = await deleteAuthor.mutateAsync(author.id);

        toast.show(
          "info",
          booksAffected === 0
            ? t("author.deleted", { name: author.name })
            : t("author.deletedWithBooks", {
                name: author.name,
                count: booksAffected,
              }),
        );

        if (getValues("authorId") === author.id) {
          /**
           * The book this dialog is editing just lost its author, server-side,
           * by the foreign key's `SetNull`.
           *
           * Cleared **without** `shouldDirty`: the column is already NULL, so
           * marking it as an edit would have the next Save send
           * `authorId: null` to say something the database has already done,
           * and would leave a dot on the tab reporting an unsaved change that
           * does not exist.
           */
          setValue("authorId", null);
          setValue("authorBiography", "");
          setName("");
        }
      } catch (error) {
        toast.show("error", errorMessage(error, t("author.deleteFailed")));
      }
    },
    [deleteAuthor, getValues, setValue, t, toast],
  );

  return {
    value: id === null ? null : { id, name },
    pick,
    create,
    remove,
    adopt,
  };
}
