import { useMemo, useState } from "react";
import { categoryIndex, categoryLabel } from "@bookcsi/shared";
import { useCategoryTree } from "../../api/categories";
import { useLocale, useT } from "../../i18n/locale-context";

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
 */
export function CategoryPicker({
  value,
  ariaLabel,
  className,
  onChange,
}: {
  value: string[];
  ariaLabel?: string;
  /** Applied to the search input. */
  className: string;
  onChange: (codes: string[]) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const { data: tree } = useCategoryTree();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const toggle = (code: string) => {
    onChange(
      selected.has(code) ? value.filter((c) => c !== code) : [...value, code],
    );
  };

  return (
    <div className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
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
      )}

      <input
        value={query}
        autoComplete="off"
        placeholder={t("category.searchPlaceholder")}
        aria-label={ariaLabel}
        className={className}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Fires after any dropdown click has been handled (the buttons preventDefault
        // their mousedown), so a pick is never lost to the box closing first.
        onBlur={() => setOpen(false)}
      />

      {open && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface-1 shadow-lg">
          {groups.map(({ group, categories }) => (
            <div key={group.code}>
              <p className="sticky top-0 bg-surface-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                {categoryLabel(group, locale)}
              </p>
              <ul>
                {categories.map((category) => {
                  const isSelected = selected.has(category.code);

                  return (
                    <li key={category.code}>
                      <button
                        type="button"
                        // Before the input's blur, which would otherwise close
                        // this list before the click reached it.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggle(category.code)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-3 ${
                          isSelected ? "text-accent" : "text-ink"
                        }`}
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
        </div>
      )}
    </div>
  );
}
