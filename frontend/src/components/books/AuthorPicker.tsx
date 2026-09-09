import { useEffect, useRef, useState } from "react";
import { sameAuthorName, type AuthorSuggestion } from "@bookcsi/shared";
import { useAuthors } from "../../api/authors";
import { useDebounced } from "../../lib/use-debounced";
import { useT } from "../../i18n/locale-context";
import { INPUT } from "./form/styles";

/** The part of an author this control needs. The biography is the tab's business. */
export interface PickedAuthor {
  id: string;
  name: string;
}

/**
 * §D51 — the Author field, and it is no longer a text field.
 *
 * The rule it exists to enforce, in the maintainer's words: **the textbox must
 * never hold text that is not an author in the database.** That single sentence
 * is what separates this from the `AuthorInput` it replaces, and it changes
 * three things at once.
 *
 * 1. **What is typed is a query, not a value.** The stored value is an author
 *    *id*; the characters in the box are how the reader is looking for it. So
 *    the two can disagree mid-search, and on blur the box snaps back to the
 *    selected author's name (or to empty). Nothing is ever left half-typed.
 * 2. **A new author takes a click.** Typing a name nobody has used before does
 *    not create anybody. The dropdown grows one clearly separated row —
 *    "Create the author …" — and that click is the only way an author comes
 *    into being. A misspelling reaches the database only if the reader looks at
 *    it and says yes.
 * 3. **Deleting is here too**, because §D51 gives authors no screen of their
 *    own. Every row carries an `✕`, and an author no book points at goes
 *    without a confirmation — there is nothing to warn about. One with books
 *    asks first, and says how many.
 *
 * ## Why there is no `register()` anywhere near this
 *
 * `.claude/mistakes.md` records a crash whose root cause is exactly the change
 * described above, and names this component as the reason it was not caught:
 * react-hook-form treats a `ref` it holds as a value it may read *back* off the
 * DOM node, and `AuthorInput` got away with that only because its displayed
 * text **was** its stored value. That is now false — the box shows a name, the
 * field holds an id — so the same wiring would feed a name back into the form
 * as an id on the next sibling field's re-render.
 *
 * So this control has no RHF ref, no hidden input and no registered field. The
 * parent owns the value through `value`/`onChange`, which is the shape
 * `CategoryPicker` moved to for the same reason.
 *
 * ## Why the dropdown is not a `role="listbox"`
 *
 * Every row holds two controls — pick the author, delete the author — and an
 * `option` may not contain interactive children. Rather than fake the pattern
 * with invalid ARIA, this follows what `CategoryPicker` and the old
 * `AuthorInput` already do: a plain list of buttons, arrow-key navigation over
 * a highlighted index, and a live region that says how many matches there are.
 */
export function AuthorPicker({
  value,
  inputId,
  invalid = false,
  onChange,
  onCreate,
  onDelete,
}: {
  value: PickedAuthor | null;
  /**
   * The id a visible `<label>` outside this component points at — which is the
   * *only* thing that names this input. There is deliberately no `aria-label`
   * to go with it: an `aria-label` overrides the visible label rather than
   * adding to it, so the two saying the same word is duplication that stays
   * correct only by luck, and the moment they disagree a screen reader reads
   * the invisible one. (It also makes `getByLabelText` match this element
   * twice, which is how the duplication was noticed.)
   */
  inputId: string;
  invalid?: boolean;
  onChange: (author: PickedAuthor | null) => void;
  /**
   * Create and select, in one act. The parent owns it because creation is a
   * request with consequences — a toast, a form field to set, a cache to
   * invalidate — and none of that is this control's business. Rejecting the
   * promise leaves the dropdown open with the typed name intact, which is the
   * behaviour §D51 asks for: the moment of confirming a name is where a problem
   * with the name should appear.
   */
  onCreate: (name: string) => Promise<PickedAuthor | null>;
  /** Delete, having already been confirmed here. Same division of labour. */
  onDelete: (author: AuthorSuggestion) => Promise<void>;
}) {
  const t = useT();

  /**
   * What is in the box. Seeded from the selected author and re-seeded whenever
   * that changes from outside — which happens on every open of the dialog, and
   * again if the tab is left and returned to.
   */
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);

  /** Which row the keyboard is on; -1 is "none, the caret is in the text". */
  const [active, setActive] = useState(-1);

  /** The row whose `✕` was pressed and which is now asking. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Re-seed the visible text when the selection changes underneath us.
   *
   * Keyed on the id rather than on the object, so a re-render that produces an
   * equal-but-new `value` does not stamp over what the reader is typing.
   */
  const seededFor = useRef<string | null>(value?.id ?? null);

  useEffect(() => {
    const id = value?.id ?? null;

    if (seededFor.current !== id) {
      seededFor.current = id;
      setQuery(value?.name ?? "");
    }
  }, [value?.id, value?.name]);

  /**
   * Whether the box is showing the selected author rather than a search.
   *
   * The two are the same characters and mean different things, which is the
   * distinction this control is built on: after a pick, the box *reports* the
   * value; while typing, it *asks* a question.
   */
  const showingSelection = value !== null && query === value.name;

  /**
   * What to actually search for — and it is empty while the box is merely
   * reporting the selection.
   *
   * Without this, clicking into a field that already holds an author searches
   * for that author's exact name and the dropdown offers exactly one row: the
   * author you already have. There is then no way to browse or switch without
   * first deleting the text, which is a step nobody should have to discover.
   * Treating "unchanged" as "no query" makes focus show the whole list, with
   * the current author ticked in it.
   */
  const searchTerm = showingSelection ? "" : query;

  const debounced = useDebounced(searchTerm, 300);
  const authors = useAuthors(debounced);

  /**
   * Normalised, not merely defaulted — `.claude/mistakes.md` has this exact
   * failure written down from §D45.
   *
   * `data` is `undefined` while loading, could be `null` from an empty
   * response, and is a plain object whenever a catch-all test mock answers
   * every URL with the same thing. `?? []` covers the first two and lets the
   * third through, and the third is the one that crashes: `matches.some` is not
   * a function, the component throws, and React unmounts the whole dialog.
   * `Array.isArray` is the guard the earlier lesson asks for at *every* reader
   * of a fetched value.
   */
  const matches = Array.isArray(authors.data) ? authors.data : [];

  /**
   * Whether the results on screen answer the text on screen.
   *
   * Load-bearing for the create row and nothing else. The query is debounced,
   * so for 300ms after a keystroke `matches` describes a *shorter* string — and
   * offering "create Frank Herber" while the answer for "Frank Herbert" is
   * still in flight is offering to create somebody who already exists. The row
   * simply does not appear until the two agree.
   */
  const settled = debounced === searchTerm && !authors.isFetching;

  const typed = query.trim();

  /**
   * The create row appears only when nothing on the server matches the typed
   * name — and "matches" folds case and diacritics exactly as the database's
   * unique index does (`sameAuthorName`). A stricter comparison here would
   * offer to create "frank herbert" next to the "Frank Herbert" it would
   * resolve to.
   */
  const canCreate =
    settled && typed !== "" && !matches.some((author) => sameAuthorName(author.name, typed));

  /** Rows the keyboard can reach: the matches, then the create row if it is there. */
  const rowCount = matches.length + (canCreate ? 1 : 0);

  const close = () => {
    setOpen(false);
    setActive(-1);
    setConfirming(null);
  };

  /**
   * The rule, enforced in one place: leaving the field cannot leave a name in
   * it that is not an author. Whatever was being typed is discarded and the box
   * goes back to saying what the form actually holds.
   */
  const revert = () => {
    setQuery(value?.name ?? "");
    close();
  };

  const select = (author: PickedAuthor) => {
    onChange(author);
    setQuery(author.name);
    close();
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    close();
    inputRef.current?.focus();
  };

  const create = async () => {
    if (typed === "" || busy) {
      return;
    }

    setBusy(true);

    try {
      const created = await onCreate(typed);

      if (created !== null) {
        select(created);
      }
      // A rejection deliberately leaves everything as it was — dropdown open,
      // name still typed — so the reader can read the toast and try again
      // without retyping.
    } finally {
      setBusy(false);
    }
  };

  const remove = async (author: AuthorSuggestion) => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await onDelete(author);
      setConfirming(null);
      // Deleting the author this book was pointing at empties the field: the
      // row it referenced is gone, and the server has already nulled the
      // column. The parent decides what that means for the form's dirty state.
      if (value?.id === author.id) {
        setQuery("");
      }
    } finally {
      setBusy(false);
    }
  };

  const activateRow = () => {
    if (active < 0) {
      return;
    }

    if (active < matches.length) {
      const author = matches[active];

      if (author !== undefined) {
        select({ id: author.id, name: author.name });
      }

      return;
    }

    void create();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          ref={inputRef}
          value={query}
          autoComplete="off"
          aria-expanded={open}
          aria-describedby={`${inputId}-status`}
          placeholder={t("author.searchPlaceholder")}
          className={
            invalid
              ? INPUT.replace("border-line", "border-error")
              : /*
                   The accent hairline means "what you are looking at is what
                   the form holds" — so it is on only while the box is showing
                   the selection, and off the moment the text becomes a search.
                   A field that kept the badge while displaying something else
                   would be claiming to hold a name it does not.
                */
                showingSelection
                ? `${INPUT} border-accent-quiet`
                : INPUT
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
            setConfirming(null);
          }}
          onFocus={() => setOpen(true)}
          /**
           * `onClick` as well as `onFocus`, because focus alone leaves a dead
           * control behind.
           *
           * Picking a suggestion closes the list and returns focus to the box
           * (so typing continues to work). The box is therefore *already*
           * focused — and clicking an already-focused input fires no `focus`
           * event. With only the handler above, a second click on the field did
           * nothing at all, and the only ways back into the list were to click
           * elsewhere and return, or to start typing. A browser test found this;
           * jsdom would have reproduced it just as faithfully and nobody had
           * thought to look.
           */
          onClick={() => setOpen(true)}
          // Fires after any dropdown click has been handled — every button in
          // the list preventDefaults its own mousedown — so a pick is never
          // lost to the box closing first.
          onBlur={revert}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((current) => (rowCount === 0 ? -1 : (current + 1) % rowCount));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) =>
                rowCount === 0 ? -1 : (current - 1 + rowCount) % rowCount,
              );
            } else if (event.key === "Enter") {
              // Only when a row is highlighted. Enter with the caret in the
              // text must not submit the form either — the dialog's Save is a
              // deliberate click, and a stray Enter in a search box should
              // never be what writes a book.
              event.preventDefault();
              activateRow();
            } else if (event.key === "Escape") {
              // Does not close the dialog: the dropdown is the innermost thing
              // open, so it is what Escape means here.
              event.stopPropagation();
              revert();
            }
          }}
        />

        {/* The way back to "no author", and it has to be its own control: the
            box holds a name that is not free text, so clearing it by selecting
            and deleting the characters would be a state the blur handler is
            obliged to undo. */}
        {value !== null && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            title={t("author.clear")}
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition-colors duration-150 hover:border-accent-quiet hover:text-ink"
          >
            <span aria-hidden>✕</span>
            <span className="sr-only">{t("author.clear")}</span>
          </button>
        )}
      </div>

      {/* The count, for a reader who cannot see the list. Polite, so it does not
          interrupt the keystroke that produced it. */}
      <p id={`${inputId}-status`} role="status" className="sr-only">
        {open ? t("author.matchCount", { count: matches.length }) : ""}
      </p>

      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface-1 shadow-lg">
          {matches.map((author, index) => (
            <li key={author.id}>
              {confirming === author.id ? (
                <DeleteConfirm
                  author={author}
                  busy={busy}
                  onCancel={() => setConfirming(null)}
                  onConfirm={() => void remove(author)}
                />
              ) : (
                <div
                  className={
                    "flex items-center gap-1 transition-colors duration-150 " +
                    (index === active ? "bg-surface-3" : "")
                  }
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select({ id: author.id, name: author.name })}
                    aria-current={author.id === value?.id}
                    className={
                      "flex min-w-0 flex-1 items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-3 " +
                      (author.id === value?.id ? "text-accent" : "text-ink")
                    }
                  >
                    <span className="truncate">
                      {/* Which one is already this book's, now that focus shows
                          the whole list. Same tick `CategoryPicker` uses. */}
                      {author.id === value?.id && <span aria-hidden>✓ </span>}
                      {author.name}
                    </span>
                    {/*
                      How many books this author has, which is the number that
                      makes the biography's reach concrete. `tabular` so a
                      column of them does not jitter (docs/DESIGN.md
                      §Tipografie).
                    */}
                    <span className="tabular shrink-0 text-xs text-ink-3">
                      {t("author.bookCount", { count: author.bookCount })}
                    </span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      // §D51 — nothing to warn about when no book points at
                      // this author, so it simply goes.
                      if (author.bookCount === 0) {
                        void remove(author);
                        return;
                      }

                      setConfirming(author.id);
                    }}
                    disabled={busy}
                    title={t("author.delete", { name: author.name })}
                    className="mr-1 shrink-0 rounded p-1.5 text-ink-3 transition-colors duration-150 hover:text-error disabled:opacity-50"
                  >
                    <span aria-hidden>✕</span>
                    <span className="sr-only">
                      {t("author.delete", { name: author.name })}
                    </span>
                  </button>
                </div>
              )}
            </li>
          ))}

          {canCreate && (
            <li>
              {/*
                The deliberate act, and it is drawn as one: separated from the
                matches above it, in the accent, and worded with the name it is
                about so that a misspelling is visible in the button the reader
                is about to press.
              */}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void create()}
                disabled={busy}
                className={
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-accent transition-colors duration-150 hover:bg-accent-quiet/30 disabled:opacity-60 " +
                  (active === matches.length ? "bg-accent-quiet/30" : "")
                }
              >
                <span aria-hidden className="text-base leading-none">
                  +
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t("author.create", { name: typed })}
                </span>
              </button>
            </li>
          )}

          {matches.length === 0 && !canCreate && (
            <li>
              <p className="px-3 py-2 text-sm text-ink-3">
                {authors.isPending || !settled
                  ? t("author.searching")
                  : t("author.noneYet")}
              </p>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The confirmation, in the row itself rather than in a dialog.
 *
 * A modal over the book form would be a modal over a modal, which
 * `Modal.tsx` does not survive — both instances put their `keydown` on
 * `document`, so one Escape would close the dialog as well as the question, and
 * both would run their own focus trap. In the row it is also simply better:
 * the thing being deleted is right there, and the sentence can name the
 * consequence without repeating which author it is about.
 */
function DeleteConfirm({
  author,
  busy,
  onCancel,
  onConfirm,
}: {
  author: AuthorSuggestion;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  return (
    <div className="flex items-center gap-2 bg-surface-2 px-3 py-2">
      <p className="min-w-0 flex-1 text-xs leading-snug text-ink-2">
        {t("author.deleteConfirm", {
          name: author.name,
          count: author.bookCount,
        })}
      </p>

      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCancel}
        className="shrink-0 rounded px-2 py-1 text-xs text-ink-3 transition-colors duration-150 hover:text-ink"
      >
        {t("common.cancel")}
      </button>

      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onConfirm}
        disabled={busy}
        className="shrink-0 rounded border border-error/50 px-2 py-1 text-xs text-error transition-colors duration-150 hover:bg-error/10 disabled:opacity-60"
      >
        {t("common.delete")}
      </button>
    </div>
  );
}
