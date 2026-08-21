import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  normalizeIsbn,
  type Book,
  type BookSuggestion,
  type CreateBookInput,
  type OpenLibraryResult,
} from "@bookcsi/shared";
import { BOOKS_KEY, useCreateBook, useIsbnDuplicates, useUpdateBook } from "../../api/books";
import {
  useEditionSuggestion,
  useIsbnSuggestion,
  uploadCoverImage,
} from "../../api/openlibrary";
import { errorMessage } from "../../lib/api";
import { useDebounced } from "../../lib/use-debounced";
import { focusable } from "../../lib/focus-trap";
import { Modal } from "../Modal";
import { StatusPill } from "../StatusPill";
import { CoverPicker } from "./CoverPicker";
import { CoverThumb } from "./CoverThumb";
import { CoverUpload } from "./CoverUpload";
import { OpenLibrarySearch } from "./OpenLibrarySearch";
import { BookTab } from "./form/BookTab";
import { DescriptionTab } from "./form/DescriptionTab";
import { ReadingTab } from "./form/ReadingTab";
import { VerdictTab } from "./form/VerdictTab";
import { BUTTON_PRIMARY, BUTTON_QUIET } from "./form/styles";
import {
  bookFormSchema,
  EMPTY,
  onlyDirty,
  onlyFilled,
  TABS,
  tabsOf,
  toFormValues,
  type BookFormValues,
  type TabId,
} from "./form/schema";
import { useT } from "../../i18n/locale-context";
import type { MessageKey } from "../../i18n/catalog";
import { useLocalizedResolver } from "../../i18n/zod-resolver";

/**
 * S1.1 (add) and S1.3 (edit) are the same form, and every field is still
 * editable at any time, whatever populated it. What changed is the shape: one
 * scroll of nineteen fields became four tabs.
 *
 * The tabs are not steps. There is one Save, it saves everything, and any tab
 * can be reached from any other in one click — a wizard would be wrong here,
 * because most visits to this dialog change exactly one field and it is never
 * the same one twice. What the tabs buy is that the two prose fields
 * (description, and now the review) get a box the size of a page instead of
 * five rows wedged between the ISBN and the page count, and that "where is this
 * book" stops being read past on the way to the title.
 *
 * Three rules run through the whole thing, and each one is somewhere else in
 * this directory:
 *
 * - **A field that does not apply is disabled, not hidden** (`form/locks.ts`).
 * - **Labels and values, nothing else** — explanations live in `title`
 *   attributes, not in rows of hint text (`form/fields.tsx`).
 * - **A change or an error on a tab you cannot see is marked on the tab**
 *   (`TAB_OF_FIELD` in `form/schema.ts`), because the alternative is a Save
 *   button that appears to do nothing.
 */
export function BookFormDialog({
  book,
  onClose,
}: {
  /** Absent when adding (S1.1), present when editing (S1.3). */
  book?: Book;
  onClose: () => void;
}) {
  const t = useT();
  const create = useCreateBook();
  const update = useUpdateBook();
  const editing = book !== undefined;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabId>("book");

  /**
   * A cover picked before the book exists — there's no id yet for the upload
   * route to address (see `CoverPicker`), so it travels alongside the create
   * request and goes up right after, the same way `olEditionKey` does.
   */
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);

  const form = useForm<BookFormValues, unknown, CreateBookInput>({
    // §D44 — the schema carries keys, so the resolver has to word them.
    resolver: useLocalizedResolver(bookFormSchema),
    defaultValues: book ? toFormValues(book) : EMPTY,
  });

  const {
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  const isbn = useDebounced(watch("isbn"), 300);
  const duplicates = useIsbnDuplicates(isbn, book?.id);

  /**
   * S4.1 / §D8 — the edition a cover will be fetched from, if the book came
   * from Open Library at all.
   *
   * Held in state rather than as a form field because it is not the user's to
   * edit: there is no input that would mean anything, and it travels with the
   * create request only.
   */
  const [olEditionKey, setOlEditionKey] = useState<string | null>(null);

  const edition = useEditionSuggestion();

  /**
   * S4.2, and the ordering the story is explicit about: the ISBN lookup waits
   * for the duplicate check to come back. "Ai deja această carte" is the
   * answer that matters more, so it goes up first; the fill follows it.
   *
   * Gated on the field being *dirty* rather than on this being a new book.
   * Both readings of "when an ISBN is entered" are covered that way, and the
   * one thing neither should do is happen on open — an edit dialog that starts
   * rewriting fields the moment it appears is its own kind of wrong.
   */
  const isbnSuggestion = useIsbnSuggestion(
    isbn,
    dirtyFields.isbn === true && duplicates.isFetched,
  );

  /**
   * Which fill has already been applied. Without it the effect below runs
   * again on every render that touches the query — refetches, cache hits,
   * a window regaining focus — and each one would undo whatever the user had
   * typed since.
   */
  const applied = useRef<string | null>(null);

  /**
   * Pour a suggestion into the form.
   *
   * `overwrite` is the difference between the two ways a suggestion arrives,
   * and it is not a detail. **Picking a search result is an explicit "this
   * book"** — the fields should become that book's, including over anything
   * half-typed. **Typing an ISBN is not**: someone who has already written a
   * title and then adds the ISBN wants the gaps filled, not their own words
   * replaced. Filling blanks only is the behaviour that can never destroy what
   * the user wrote, which is why it is the one that runs unprompted.
   */
  const fill = useCallback(
    (suggestion: BookSuggestion, { overwrite }: { overwrite: boolean }) => {
      const set = (field: FillableField, value: string) => {
        if (value === "" || (!overwrite && getValues(field).trim() !== "")) {
          return;
        }

        // `shouldDirty` is what makes the value survive an edit: `onlyDirty`
        // sends the fields the user changed, and a silently-set field is one
        // the form would drop on the way out.
        //
        // `shouldValidate` clears the error the fill has just answered. Without
        // it, someone who scans a barcode and hits Save before the lookup lands
        // is left looking at "Titlul e obligatoriu" *under a filled-in title* —
        // the message is stale, but nothing on screen says so, and the only way
        // out is to touch the field.
        setValue(field, value, { shouldDirty: true, shouldValidate: true });
      };

      set("title", suggestion.title);
      set("author", suggestion.author ?? "");
      set("isbn", suggestion.isbn ?? "");
      set("totalPages", suggestion.totalPages === null ? "" : String(suggestion.totalPages));
      set("publisher", suggestion.publisher ?? "");
      set(
        "publicationYear",
        suggestion.publicationYear === null ? "" : String(suggestion.publicationYear),
      );
      set("format", suggestion.format ?? "");
    },
    [getValues, setValue],
  );

  useEffect(() => {
    if (!isbnSuggestion.isSuccess) {
      return;
    }

    const key = normalizeIsbn(isbn);

    if (applied.current === key) {
      return;
    }

    applied.current = key;
    fill(isbnSuggestion.data, { overwrite: false });
    setOlEditionKey(isbnSuggestion.data.olEditionKey);
  }, [isbnSuggestion.isSuccess, isbnSuggestion.data, isbn, fill]);

  /** S4.1 — a chosen work, resolved into the edition its fields come from. */
  const selectResult = async (result: OpenLibraryResult) => {
    // Title and author are already known from the search row, so they land
    // immediately; the round trip is only for the ISBN and the page count.
    fill(
      {
        title: result.title,
        author: result.author,
        isbn: null,
        totalPages: null,
        publisher: null,
        publicationYear: result.firstPublishYear,
        format: null,
        olEditionKey: result.editionKey,
        thumbnailUrl: result.thumbnailUrl,
      },
      { overwrite: true },
    );
    setOlEditionKey(result.editionKey);

    if (result.editionKey === null) {
      return;
    }

    // A failure here costs the ISBN and the page count, not the selection: the
    // title and author are already in, and the rest is typeable. The
    // degradation criterion is that nothing gets stuck.
    const suggestion = await edition.mutateAsync(result.editionKey).catch(() => null);

    if (suggestion !== null) {
      fill(suggestion, { overwrite: true });
      // Prevents the ISBN just filled in from triggering S4.2's lookup for the
      // edition it came from.
      applied.current = normalizeIsbn(suggestion.isbn ?? "");
    }
  };

  const submit = handleSubmit(
    async (payload) => {
      if (editing) {
        // Only what the user actually touched. Sending an untouched empty date
        // would read as "clear it", and would stop the API from stamping the
        // transition date this very request just triggered (S1.5).
        const changed = onlyDirty(payload, dirtyFields);

        if (Object.keys(changed).length > 0) {
          await update.mutateAsync({ id: book.id, input: changed });
        }
      } else {
        // §D8: given the edition, the server downloads and stores the cover as
        // part of creating the book. Nothing else on the client knows about it.
        const created = await create.mutateAsync({
          ...onlyFilled(payload),
          ...(olEditionKey === null ? {} : { olEditionKey }),
        });

        // A manually picked file goes up once the id it needs exists — after
        // the dialog is already gone, on the same best-effort footing as the
        // Open Library fetch above: a failure here costs the cover, not the
        // book, and Edit is the way back to it.
        if (pendingCoverFile !== null) {
          void uploadCoverImage(created.id, pendingCoverFile)
            .then(() => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }))
            .catch(() => {});
        }
      }

      onClose();
    },
    /**
     * The invalid branch, and the one piece of plumbing tabs make compulsory.
     *
     * `shouldFocusError` cannot focus an input that is not mounted, so without
     * this a title cleared on the "Carte" tab would fail validation while the
     * user is looking at "Verdict" — and Save would do nothing, visibly. So
     * the first tab holding an error becomes the visible one, and the red dot
     * on the strip says where the rest are.
     */
    (invalid) => {
      const [first] = tabsOf(Object.keys(invalid));

      if (first !== undefined) {
        setTab(first);
      }
    },
  );

  const failure = create.error ?? update.error;
  const status = watch("status");

  const dirtyTabs = tabsOf(Object.keys(dirtyFields));
  const invalidTabs = tabsOf(Object.keys(errors));

  /**
   * The keyboard's first stop, and it is not the tab strip.
   *
   * `Modal` focuses the first control it finds, which with tabs is the "Carte"
   * button — a control nobody opened this dialog to press. Mount only: switching
   * tabs deliberately leaves focus on the tab, which is what a tablist is
   * supposed to do.
   */
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusable(panelRef.current)[0]?.focus();
  }, []);

  return (
    <Modal
      wide
      sheet
      dismissible
      autoFocus={false}
      title={editing ? t("bookForm.editTitle") : t("bookForm.addTitle")}
      onClose={onClose}
      header={
        <div className="flex items-start gap-3 border-b border-line px-5 py-4 pr-16">
          {editing && <CoverThumb title={book.title} coverUrl={book.coverUrl} />}

          <div className="min-w-0 flex-1">
            {/*
              The stored title, not `watch("title")`.

              A header that mirrors the field two rows below it says the same
              string twice, jitters on every keystroke, and goes blank at the
              exact moment it is most useful — when the title is being
              select-all-retyped and the old one is the thing worth still
              seeing. It updates when the save lands.
            */}
            <h2 className="line-clamp-2 font-display text-lg text-ink sm:text-xl">
              {editing ? book.title : t("bookForm.addTitle")}
            </h2>

            {editing && (
              <p className="mt-1 truncate text-xs text-ink-3">
                {[book.author, book.publisher, book.publicationYear]
                  .filter((part) => part !== null && part !== "")
                  .join(" · ")}
              </p>
            )}
          </div>

          {/* Live, unlike the title: the pill follows the selection on the
              reading tab, because a choice being confirmed is not the same
              thing as a field jittering under the keyboard. */}
          {editing && (
            <div className="shrink-0 pt-0.5">
              <StatusPill status={status} />
            </div>
          )}
        </div>
      }
    >
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabStrip active={tab} onSelect={setTab} dirty={dirtyTabs} invalid={invalidTabs} />

        {/*
          One height for every tab.

          The panel is as tall as the tallest tab needs and stays that way, so
          switching tabs does not resize the dialog under the pointer — the
          failure that makes tabbed forms feel unstable. Prose tabs stretch
          into the space instead of leaving it empty; anything taller scrolls.
        */}
        <div
          ref={panelRef}
          role="tabpanel"
          id={`book-form-panel-${tab}`}
          aria-labelledby={`book-form-tab-${tab}`}
          className={
            /*
              `max-sm:flex-1` and *not* `flex-1`, which is the whole fix for a
              bug this comment exists to prevent coming back: `flex: 1 1 0%`
              sets the flex basis to zero, so a height on the same element is
              ignored and the panel ends up sized by its content — the dialog
              then changed height on every tab switch, which is exactly what a
              constant body height is here to stop. On a phone the sheet has a
              height of its own, so there the body may take what is left.
            */
            "flex min-h-0 flex-col overflow-y-auto px-5 py-5 max-sm:flex-1 " +
            (editing ? "sm:h-[27rem]" : "sm:h-[31rem]")
          }
        >
          {tab === "book" && (
            <BookTab
              form={form}
              cover={
                editing ? (
                  <CoverUpload book={book} />
                ) : (
                  <CoverPicker
                    title={watch("title")}
                    file={pendingCoverFile}
                    onChange={setPendingCoverFile}
                  />
                )
              }
              openLibrary={
                editing ? undefined : (
                  <OpenLibrarySearch
                    onSelect={(result) => void selectResult(result)}
                    busy={edition.isPending}
                  />
                )
              }
              notes={
                <>
                  {/* The duplicate warning comes first, and it comes first on
                      screen too: S4.2's fill is the convenience, this is the
                      answer. */}
                  {duplicates.data && duplicates.data.length > 0 && (
                    <DuplicateWarning titles={duplicates.data.map((d) => d.title)} />
                  )}

                  <IsbnLookupNote
                    pending={isbnSuggestion.isFetching}
                    found={isbnSuggestion.isSuccess}
                    error={isbnSuggestion.error}
                  />
                </>
              }
            />
          )}

          {tab === "description" && <DescriptionTab form={form} />}

          {tab === "reading" && <ReadingTab form={form} />}

          {tab === "verdict" && (
            <VerdictTab
              form={form}
              onFinish={() =>
                setValue("status", "FINISHED", { shouldDirty: true, shouldValidate: true })
              }
            />
          )}
        </div>

        {failure && (
          <p role="alert" className="px-5 pb-2 text-sm text-error">
            {errorMessage(failure, failure.message)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">
          <button type="button" onClick={onClose} className={BUTTON_QUIET}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting
              ? t("common.saving")
              : editing
                ? t("common.save")
                : t("common.add")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The four tabs, as a real tablist.
 *
 * Arrow keys move between them because that is what a tablist does, and the
 * dots are the reason the strip carries any state at all: brass for "you have
 * unsaved changes over there", the app's one red for "there is something to fix
 * over there". Both are announced as well as drawn — a dot nobody can hear is
 * half a signal.
 */
function TabStrip({
  active,
  onSelect,
  dirty,
  invalid,
}: {
  active: TabId;
  onSelect: (tab: TabId) => void;
  dirty: TabId[];
  invalid: TabId[];
}) {
  const t = useT();

  const LABEL: Record<TabId, MessageKey> = {
    book: "bookForm.tab.book",
    description: "bookForm.tab.description",
    reading: "bookForm.tab.reading",
    verdict: "bookForm.tab.verdict",
  };

  const move = (from: TabId, step: number) => {
    const next = TABS[(TABS.indexOf(from) + step + TABS.length) % TABS.length];
    onSelect(next);
  };

  return (
    <div
      role="tablist"
      aria-label={t("bookForm.editTitle")}
      className="flex gap-1 overflow-x-auto border-b border-line px-2 sm:gap-6 sm:px-5"
    >
      {TABS.map((tab) => {
        const selected = tab === active;
        const isInvalid = invalid.includes(tab);
        const isDirty = !isInvalid && dirty.includes(tab);

        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`book-form-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`book-form-panel-${tab}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                move(tab, 1);
              } else if (event.key === "ArrowLeft") {
                move(tab, -1);
              }
            }}
            className={
              "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2 py-3 text-sm transition-colors duration-150 sm:flex-none sm:justify-start " +
              (selected
                ? "text-ink after:absolute after:inset-x-1 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-accent sm:after:inset-x-0"
                : "text-ink-3 hover:text-ink-2")
            }
          >
            {t(LABEL[tab])}

            {(isDirty || isInvalid) && (
              <>
                <span
                  aria-hidden
                  className={
                    "size-1.5 shrink-0 rounded-full " +
                    (isInvalid ? "bg-error" : "bg-accent")
                  }
                />
                <span className="sr-only">
                  {t(isInvalid ? "bookForm.tabInvalid" : "bookForm.tabChanged")}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * S1.1 / §D13. Deliberately worded as a reminder, not as a problem: a re-read
 * and a second edition are both legitimate, so nothing here blocks the save.
 */
function DuplicateWarning({ titles }: { titles: string[] }) {
  const t = useT();
  return (
    <p className="rounded-lg border border-accent-quiet bg-accent-quiet/30 px-3 py-2 text-xs text-accent">
      {t("bookForm.duplicate", {
        titles: titles.map((title) => `„${title}"`).join(", "),
      })}
    </p>
  );
}

/**
 * S4.2 — what the ISBN lookup is doing, in one line under the field.
 *
 * A miss is the ordinary outcome and reads like one: most ISBNs are not in
 * Open Library, the story asks for a clear message, and the sentence says the
 * form still works rather than implying something broke. Nothing here blocks
 * anything — the same posture as the duplicate warning above it.
 */
function IsbnLookupNote({
  pending,
  found,
  error,
}: {
  pending: boolean;
  found: boolean;
  error: Error | null;
}) {
  const t = useT();

  if (pending) {
    return <Note>{t("bookForm.searchingIsbn")}</Note>;
  }

  if (error !== null) {
    return <Note>{errorMessage(error, t("bookForm.olUnavailable"))}</Note>;
  }

  if (found) {
    return <Note>{t("bookForm.fromOpenLibrary")}</Note>;
  }

  return null;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-xs text-ink-3">
      {children}
    </p>
  );
}

/**
 * The fields Open Library can speak to (S4.1, S4.2). Everything else on
 * the form is the user's own — a status, a rating, a review, what they paid —
 * and no external source has an opinion worth pouring into them.
 */
type FillableField =
  | "title"
  | "author"
  | "isbn"
  | "totalPages"
  | "publisher"
  | "publicationYear"
  | "format";
