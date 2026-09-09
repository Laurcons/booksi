import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { AuthorSuggestion, CreateBookInput } from "@bookcsi/shared";
import {
  useAuthor,
  useCreateAuthor,
  useDeleteAuthor,
} from "../../../api/authors";
import { errorMessage } from "../../../lib/api";
import { useLocale, useT } from "../../../i18n/locale-context";
import { useToast } from "../../toast/toast-context";
import { AuthorPicker, type PickedAuthor } from "../AuthorPicker";
import { CharCount, Field } from "./fields";
import { BIOGRAPHY_MAX, type BookFormValues } from "./schema";
import { TEXTAREA } from "./styles";

/**
 * §D51 — tab two: **who wrote it**.
 *
 * The author left the Carte tab entirely rather than keeping the name there and
 * putting the biography here. Splitting one entity across two tabs would have
 * been the worst of both: the reader would pick a person in one place and
 * describe them in another, and the note that says "this applies to all your
 * books by them" would sit nowhere near the control that chose them.
 *
 * Two things on this tab are not like anything else in this dialog, and both
 * are consequences of the author being a **separate row**:
 *
 * 1. **Creating and deleting happen immediately**, not on Save. A name is
 *    confirmed in the picker, so that is where a problem with the name belongs
 *    — three tabs and one click away is not where anyone would look for it.
 *    Cancelling the dialog therefore does not undo them, which is the accepted
 *    cost (`useCreateAuthor` has the full argument).
 * 2. **The biography is saved by its own request**, on the dialog's one Save,
 *    and it reaches every book by this author. `BookFormDialog` fires both
 *    writes together and reports honestly when only one lands.
 *
 * The rule §D48 laid down — "labels and values, nothing else" — takes its
 * second deliberate exception here, after the character counter. The line under
 * the box saying how many books an edit reaches is not a hint that could live
 * in a `title` attribute: without it, this is a textarea that silently rewrites
 * pages the reader is not looking at.
 */
export function AuthorTab({
  form,
  authorName,
  onNameChange,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
  /**
   * The selected author's name, for the picker to display.
   *
   * A prop rather than a form field, and the reason is in `schema.ts`: a name
   * is display state, and a validated field with no input of its own can fail
   * validation and leave `handleSubmit` refusing to run over something nobody
   * can see or fix. It lives in `BookFormDialog`'s state — which does not
   * unmount when tabs switch, unlike this component.
   */
  authorName: string;
  onNameChange: (name: string) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const toast = useToast();

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const authorId = watch("authorId");
  const biography = watch("authorBiography");

  const createAuthor = useCreateAuthor();
  const deleteAuthor = useDeleteAuthor();

  /**
   * The selected author's own row — fetched for one number and one string.
   *
   * The `bookCount` is the number in the note below, and there is no other way
   * to it: it is deliberately absent from the author embedded in a book
   * response, because a `COUNT` per row of every library listing to render a
   * line only this tab shows is not a trade worth making (§D51).
   *
   * The biography comes back too, and it matters only when the reader has
   * **switched** author: the dialog seeded this field from the book it opened,
   * so there is no request on open and no flash of an empty box.
   */
  const selected = useAuthor(authorId);

  /**
   * Pour the fetched biography in when the reader switches author.
   *
   * **`setValue` without `shouldDirty`, never `resetField`.** The distinction
   * runs through this whole file and it is not stylistic:
   *
   * - `setValue(name, value)` with no options sets the value and leaves
   *   `dirtyFields` alone, so the field reads as "this is what is stored"
   *   rather than "the reader changed this". That is exactly right here — the
   *   text arriving is the author's own biography, so a Save must not write it
   *   back over itself, and the tab must not grow a dot for a change nobody
   *   made.
   * - `resetField` would say the same thing more precisely, by moving the
   *   field's *default*. It is not used because **it silently does nothing on a
   *   field react-hook-form never registered**: it looks the field up in
   *   `_fields`, and `authorId` has no input by design (see `AuthorPicker`).
   *   The failure is invisible — no error, no warning, the value simply stays —
   *   which is how it was found: a deleted author cleared the picker's box and
   *   left the form still holding its id.
   *
   * Gated on the fetched author actually being the selected one, so a stale
   * response arriving after a second switch cannot overwrite the newer one.
   */
  useEffect(() => {
    if (selected.data === undefined || selected.data.id !== authorId) {
      return;
    }

    setValue("authorBiography", selected.data.biography ?? "");
  }, [selected.data, authorId, setValue]);

  const pick = (author: PickedAuthor | null) => {
    // `shouldDirty` on the id, because that *is* a change to the book. The name
    // travels quietly alongside it: it is display only, and marking it would
    // put a second dot's worth of meaning on one decision.
    setValue("authorId", author?.id ?? null, { shouldDirty: true });
    onNameChange(author?.name ?? "");

    if (author === null) {
      // Nothing selected, nothing to write about. Cleared without dirtying, so
      // Save does not try to `PATCH` an author that is no longer chosen.
      setValue("authorBiography", "");
    }
  };

  const create = async (name: string): Promise<PickedAuthor | null> => {
    try {
      const author = await createAuthor.mutateAsync({ name });
      toast.show("info", t("author.created", { name: author.name }));
      return author;
    } catch (error) {
      // Reported where the name was confirmed, which is the reason creation is
      // immediate rather than deferred to Save (§D51).
      toast.show("error", errorMessage(error, t("author.createFailed")));
      return null;
    }
  };

  const remove = async (author: AuthorSuggestion) => {
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

      if (authorId === author.id) {
        /**
         * The book this dialog is editing just lost its author, server-side,
         * by the foreign key's `SetNull`.
         *
         * Cleared **without** `shouldDirty`: the column is already NULL, so
         * marking it as an edit would have the next Save send `authorId: null`
         * to say something the database has already done, and would leave a dot
         * on the tab reporting an unsaved change that does not exist.
         */
        setValue("authorId", null);
        setValue("authorBiography", "");
        onNameChange("");
      }
    } catch (error) {
      toast.show("error", errorMessage(error, t("author.deleteFailed")));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Field
        label={t("field.author")}
        htmlFor="book-form-author"
        error={errors.authorId}
      >
        <AuthorPicker
          inputId="book-form-author"
          value={authorId === null ? null : { id: authorId, name: authorName }}
          onChange={pick}
          onCreate={create}
          onDelete={remove}
        />
      </Field>

      {authorId === null ? (
        <NoAuthor />
      ) : (
        <Field
          label={t("field.biography")}
          htmlFor="book-form-biography"
          error={errors.authorBiography}
          trailing={
            <CharCount value={biography} max={BIOGRAPHY_MAX} locale={locale} t={t} />
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <textarea
            id="book-form-biography"
            {...register("authorBiography")}
            className={`${TEXTAREA} h-full min-h-[10rem] flex-1`}
            placeholder={t("field.biographyPlaceholder")}
          />

          <SharedScopeNote
            name={authorName}
            bookCount={selected.data?.bookCount ?? null}
          />
        </Field>
      )}
    </div>
  );
}

/**
 * §D51 — the subtle indication, and the count is what makes it one.
 *
 * "This is shared" is an abstraction nobody acts on. "This applies to all 4 of
 * your books by Frank Herbert" is a fact, and it is the difference between a
 * disclaimer and information — the reader learns both that the field is shared
 * *and* how far it reaches, in one line they were going to read anyway because
 * it sits under the box they are typing in.
 *
 * Drawn as quietly as the character counter it shares a field with: `ink-3`, no
 * border, no icon, no colour. It is not a warning — writing a biography from
 * one book is the intended way to write one — so it must not look like the
 * duplicate-ISBN notice, which *is* one.
 *
 * The count is `null` for the moment before the author's row arrives. The
 * sentence then says the true thing it can ("applies to every book by this
 * author") rather than flashing a wrong number or an empty gap that reflows
 * the layout when it fills.
 */
function SharedScopeNote({
  name,
  bookCount,
}: {
  name: string;
  bookCount: number | null;
}) {
  const t = useT();

  return (
    <p className="mt-2 text-xs leading-relaxed text-ink-3">
      {bookCount === null
        ? t("author.sharedUnknown")
        : t("author.shared", { name, count: bookCount })}
    </p>
  );
}

/**
 * What the tab says when no author is chosen — which is most books at first
 * (§D4), so this is the state the tab is in more often than not.
 *
 * It explains the one thing about this screen that is not obvious from looking
 * at it: that an author has to be picked or made before there is anywhere to
 * write about them. The same reasoning as the description's empty state on the
 * book's page (docs/DESIGN.md §Fișa cărții) — a blank is where you say what
 * fills it.
 */
function NoAuthor() {
  const t = useT();

  return (
    <p className="rounded-lg border border-line bg-surface-1/60 px-3 py-2.5 text-xs leading-relaxed text-ink-3">
      {t("author.noneSelected")}
    </p>
  );
}
