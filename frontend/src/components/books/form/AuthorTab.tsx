import type { UseFormReturn } from "react-hook-form";
import type { CreateBookInput } from "@bookcsi/shared";
import { useAuthor } from "../../../api/authors";
import { useLocale, useT } from "../../../i18n/locale-context";
import { AuthorField } from "./AuthorField";
import { CharCount, Field } from "./fields";
import { BIOGRAPHY_MAX, type BookFormValues } from "./schema";
import { TEXTAREA } from "./styles";
import type { AuthorSelection } from "./use-author-selection";

/**
 * §D51 — tab two: **who wrote it**, and what there is to say about them.
 *
 * The picker at the top is the same control the Carte tab carries, for the
 * reasons `AuthorField` gives. What is only here is the **biography**, and it is
 * the reason this tab exists: it is a third field of prose, and prose wedged
 * into a grid of values is what §D48 split this form up to stop.
 *
 * Two things about the biography are not like anything else in this dialog, and
 * both are consequences of the author being a **separate row**:
 *
 * 1. **Creating and deleting an author happen immediately**, not on Save. A
 *    name is confirmed in the picker, so that is where a problem with the name
 *    belongs — three tabs and one click away is not where anyone would look for
 *    it. Cancelling the dialog therefore does not undo them, which is the
 *    accepted cost (`useCreateAuthor` has the full argument).
 * 2. **The biography is saved by its own request**, on the dialog's one Save,
 *    and it reaches every book by this author. `BookFormDialog` fires both
 *    writes together and reports honestly when only one lands.
 *
 * The rule §D48 laid down — "labels and values, nothing else" — takes its
 * second deliberate exception here, after the character counter. The line under
 * the box saying how many books an edit reaches is not a hint that could live
 * in a `title` attribute: without it, this is a textarea that silently rewrites
 * pages the reader is not looking at.
 *
 * There is deliberately **no effect** in this file. The biography is poured in
 * by whatever changed the author (`useAuthorSelection`), because an effect here
 * would run on every mount — and with tabs, a panel mounts on every visit, so
 * it overwrote what the reader had typed. `useAuthor` below is read for one
 * number and nothing else.
 */
export function AuthorTab({
  form,
  selection,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
  selection: AuthorSelection;
}) {
  const t = useT();
  const { locale } = useLocale();

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const authorId = watch("authorId");
  const biography = watch("authorBiography");

  /**
   * The selected author's row — fetched for one number.
   *
   * The `bookCount` is the number in the note below, and there is no other way
   * to it: it is deliberately absent from the author embedded in a book
   * response, because a `COUNT` per row of every library listing to render a
   * line only this tab shows is not a trade worth making (§D51).
   */
  const selected = useAuthor(authorId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AuthorField
        selection={selection}
        inputId="book-form-author-detail"
        error={errors.authorId}
      />

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
            name={selection.value?.name ?? ""}
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
