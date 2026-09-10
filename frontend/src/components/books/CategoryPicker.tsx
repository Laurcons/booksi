import { useId, useMemo, useRef, useState } from "react";
import { categoryIndex, categoryLabel } from "@bookcsi/shared";
import { useCategoryTree } from "../../api/categories";
import { useLocale, useT } from "../../i18n/locale-context";
import { useAnchoredPosition } from "../../lib/use-anchored-position";
import { AnchoredPanel } from "../AnchoredPanel";

/**
 * §D45 — the category field (form) and filter (gallery): a searchable,
 * grouped, **multi-select** of the taxonomy.
 *
 * Three things the old single-value combobox did not have to be:
 *
 * 1. **Multi-value.** A book sits on several shelves now, so selection is a
 *    set of codes shown as removable chips, and picking a row toggles it
 *    rather than replacing what was there.
 * 2. **Grouped, with non-selectable headings.** A group is a heading only
 *    (§D45); it renders as a label that cannot be clicked. A group is shown
 *    when its own name matches the search, or when any of its shelves do — so
 *    typing "medicină" reveals every shelf under it.
 * 3. **Fed from the API, not a compile-time constant.** The tree is fetched
 *    once and cached hard (`useCategoryTree`); both labels ride on each node,
 *    so filtering and rendering follow a language switch without a refetch.
 *
 * Unlike the old picker there is no hidden `<input>` and no react-hook-form
 * ref: the value is an array the parent owns through `value`/`onChange`, so the
 * RHF-reads-the-DOM hazard that .claude/mistakes.md records simply cannot arise
 * — nothing here is a registered field.
 *
 * ## The list is drawn over the page, not inside the field
 *
 * It is portalled and positioned against the field in viewport coordinates
 * (`useAnchoredPosition`), because an `absolute` list is clipped by any
 * ancestor that scrolls — and in the book form this one sits on the last row of
 * a tab panel with a fixed height, where it was cut off a few pixels below the
 * box. Its limits are the page's now.
 *
 * The consequence is that the rows are outside `Modal`'s focus trap, so they
 * are **not tabbable**: `tabIndex={-1}` throughout, and the keyboard drives
 * the list with the arrows over a highlighted index, exactly as `AuthorPicker`
 * does. That is an improvement rather than a compromise — before, Tab walked
 * through every shelf in the taxonomy on the way to the next field.
 *
 * Deliberately not a `role="listbox"`, for the reason `AuthorPicker` sets out
 * at length: a heading that cannot be chosen is not an `option`, and faking the
 * pattern with invalid ARIA is worse than a plain list of buttons with a live
 * region that says how many matches there are.
 */
export function CategoryPicker({
  value,
  ariaLabel,
  inputId,
  className,
  chipsInside = false,
  onChange,
}: {
  value: string[];
  ariaLabel?: string;
  /** So a visible `<label>` outside this component can point at the search box. */
  inputId?: string;
  /**
   * Draw the chips *inside* the field's own border, with the search box as the
   * last thing on the line — the book form's shape (§D48), where the picker has
   * to read as one control among several rather than as a list with a box under
   * it. The gallery filter keeps the stacked arrangement, where the chips are a
   * summary of what is being filtered and belong above the control.
   */
  chipsInside?: boolean;
  /** Applied to the search input. */
  className: string;
  onChange: (codes: string[]) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { data: tree } = useCategoryTree();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** Which row the keyboard is on; -1 is "none, the caret is in the text". */
  const [active, setActive] = useState(-1);

  const statusId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const { anchorRef, position } = useAnchoredPosition(open, 288, close);

  // `data` is `undefined` while loading and could be `null` from an empty
  // response; both mean "no tree yet". Normalise once — memoised so its identity
  // is stable, which keeps the two memos below from recomputing every render.
  const safeTree = useMemo(() => (Array.isArray(tree) ? tree : []), [tree]);
  const index = useMemo(() => categoryIndex(safeTree), [safeTree]);
  const selected = new Set(value);

  const search = query.trim().toLowerCase();

  // Each group kept only if it (or one of its shelves) matches, and narrowed to
  // the shelves that match — unless the group name itself matched, in which case
  // all its shelves show, which is what makes a group name a way to reveal them.
  const groups = useMemo(() => {
    return safeTree
      .map((group) => {
        const groupMatches = categoryLabel(group, locale).toLowerCase().includes(search);
        const categories = group.categories.filter(
          (category) =>
            groupMatches || categoryLabel(category, locale).toLowerCase().includes(search),
        );

        return { group, categories };
      })
      .filter((entry) => entry.categories.length > 0);
  }, [safeTree, locale, search]);

  /** The selectable rows, in the order the arrows walk them — headings are not. */
  const rows = groups.flatMap((entry) => entry.categories);

  const toggle = (code: string) => {
    onChange(
      selected.has(code) ? value.filter((c) => c !== code) : [...value, code],
    );
  };

  /**
   * Choosing from the list, which is not the same act as removing a chip.
   *
   * The search that found this shelf has done its job, so the box is cleared:
   * leaving the text in it leaves the list filtered to the one row just picked,
   * and a second selection then needs a manual clear first. The trade-off is
   * real and was taken deliberately — picking two shelves out of one search
   * ("art" → theory *and* history) now costs retyping — because moving on to an
   * unrelated shelf is the commoner case by a distance.
   *
   * Deliberately **not** inside `toggle`, which the chips' `✕` also calls:
   * wiping somebody's half-typed search because they removed an unrelated chip
   * would be a second surprise in place of the first.
   */
  const pick = (code: string) => {
    toggle(code);
    setQuery("");
    setActive(-1);

    // The list is about to grow back to the whole tree, and would otherwise be
    // rendered at the offset a one-row list had been scrolled to.
    if (panelRef.current !== null) {
      panelRef.current.scrollTop = 0;
    }
  };

  const chips = value.length === 0 ? null : (
    <ul className={chipsInside ? "flex flex-wrap gap-1.5" : "mb-2 flex flex-wrap gap-1.5"}>
          {value.map((code) => {
            const node = index.get(code);
            const label = node ? categoryLabel(node.category, locale) : code;

            return (
              <li key={code}>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 text-xs text-ink-2">
                  {label}
                  <button
                    type="button"
                    aria-label={t("category.remove", { label })}
                    onClick={() => toggle(code)}
                    className="text-ink-3 transition-colors duration-150 hover:text-ink"
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
      })}
    </ul>
  );

  const field = (
    <input
      value={query}
        autoComplete="off"
      placeholder={t("category.searchPlaceholder")}
      id={inputId}
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-describedby={statusId}
      className={
        chipsInside
          ? "min-w-24 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          : className
      }
      onChange={(event) => {
        setQuery(event.target.value);
        setOpen(true);
        // The list under the caret is about to be a different list.
        setActive(-1);
      }}
      onFocus={() => setOpen(true)}
      /*
        And `onClick` as well as `onFocus`, which is the lesson
        `.claude/mistakes.md` records against `AuthorPicker`: picking a row
        keeps focus in the box, so a second click on an already-focused field
        fires no `focus` event and the list would stay shut.
      */
      onClick={() => setOpen(true)}
      // Fires after any dropdown click has been handled (the buttons preventDefault
      // their mousedown), so a pick is never lost to the box closing first.
      onBlur={close}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
          setActive((current) => (rows.length === 0 ? -1 : (current + 1) % rows.length));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive((current) =>
            rows.length === 0 ? -1 : (current - 1 + rows.length) % rows.length,
          );
        } else if (event.key === "Enter") {
          // Prevented whether or not a row is highlighted: a stray Enter in a
          // search box must never be what submits the book form.
          event.preventDefault();

          const row = rows[active];

          if (row !== undefined) {
            pick(row.code);
          }
        } else if (event.key === "Escape") {
          // The list is the innermost thing open, so Escape belongs to it and
          // must not reach the dialog behind (§D49 would nudge or close it).
          event.stopPropagation();
          close();
        }
      }}
    />
  );

  return (
    <div ref={anchorRef}>
      {chipsInside ? (
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-2 py-1.5 focus-within:border-accent">
          {chips}
          {field}
        </div>
      ) : (
        <>
          {chips}
          {field}
        </>
      )}

      {/* The count, for a reader who cannot see the list. Polite, so it does not
          interrupt the keystroke that produced it. */}
      <p id={statusId} role="status" className="sr-only">
        {open ? t("category.matchCount", { count: rows.length }) : ""}
      </p>

      {open && (
        <AnchoredPanel position={position} panelRef={panelRef}>
          {groups.map(({ group, categories }) => (
            <div key={group.code}>
              <p className="sticky top-0 bg-surface-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {categoryLabel(group, locale)}
              </p>
              <ul>
                {categories.map((category) => {
                  const isSelected = selected.has(category.code);
                  const isActive = rows[active]?.code === category.code;

                  return (
                    <li key={category.code}>
                      <button
                        type="button"
                        // Outside the modal's focus trap — the file header has
                        // the argument. The arrows are the way through the list.
                        tabIndex={-1}
                        // Before the input's blur, which would otherwise close
                        // this list before the click reached it.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(category.code)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-3 ${
                          isActive ? "bg-surface-3 " : ""
                        }${isSelected ? "text-accent" : "text-ink"}`}
                      >
                        <span>{categoryLabel(category, locale)}</span>
                        {isSelected && <span aria-hidden="true">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-3">{t("search.noCategoryMatches")}</p>
          )}
        </AnchoredPanel>
      )}
    </div>
  );
}
