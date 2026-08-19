import { useEffect, useMemo, useState, type FocusEventHandler, type Ref } from "react";
import { genreLabel, GENRE_VALUES, type Genre } from "@bookcsi/shared";
import { useLocale } from "../../i18n/locale-context";

/**
 * The category field (form) and filter (gallery), searchable rather than a
 * 29-item `<select>` scroll — §D39 replaced the old 17-genre list with one
 * long enough that finding a value by eye stopped being fast.
 *
 * Unlike `AuthorInput`, the text shown and the value stored are not the same
 * string: the box displays a Romanian label, the field holds a code. So
 * typing never writes the value directly — only picking a row (or the clear
 * row) does — and blurring without a pick snaps the text back to whatever is
 * actually selected, so the box can never show something that was never
 * chosen.
 *
 * `inputRef`/`name` (react-hook-form's `register("genre")`) land on a hidden
 * input that always carries the real code, never on the visible one. RHF
 * treats a registered ref as a source of truth it may read straight from the
 * DOM — hand it the label-displaying input instead and a re-render elsewhere
 * in the form reads back "Ghiduri și hărți turistice, atlase" as the field's
 * value, which isn't a valid `Genre` and crashes the next render.
 */
export function CategoryPicker({
  name,
  value,
  clearLabel,
  ariaLabel,
  className,
  onChange,
  onBlur,
  inputRef,
}: {
  name?: string;
  value: Genre | "";
  /** What an empty selection reads as — "— fără categorie —" on the form, "Toate categoriile" on the filter. */
  clearLabel: string;
  ariaLabel?: string;
  className: string;
  onChange: (value: Genre | "") => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const { locale } = useLocale();

  const selectedLabel = value === "" ? "" : genreLabel(value, locale);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);

  // The value can change from outside (a suggestion filled it, a filter got
  // cleared, the form reset to a different book) without the box itself
  // being the cause — keep the displayed text in step with those.
  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  const search = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      GENRE_VALUES.filter((genre) =>
        genreLabel(genre, locale).toLowerCase().includes(search),
      ),
    // `locale` is load-bearing, not ceremony: the labels being filtered are the
    // translated ones, so a language change has to re-filter or the box goes on
    // matching against words no longer on screen.
    [search, locale],
  );

  const choose = (genre: Genre | "") => {
    setOpen(false);
    onChange(genre);
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} ref={inputRef} value={value} readOnly />

      <input
        value={query}
        autoComplete="off"
        placeholder={clearLabel}
        aria-label={ariaLabel}
        className={className}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          setOpen(false);
          setQuery(selectedLabel);
          onBlur?.(event);
        }}
      />

      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface-1 shadow-lg">
          <li>
            <button
              type="button"
              // Fires before the input's own blur, which would otherwise
              // close this list before the click ever reached it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose("")}
              className="block w-full px-3 py-2 text-left text-sm text-ink-3 transition-colors duration-150 hover:bg-surface-3"
            >
              {clearLabel}
            </button>
          </li>

          {matches.map((genre) => (
            <li key={genre}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(genre)}
                className="block w-full px-3 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface-3"
              >
                {genreLabel(genre, locale)}
              </button>
            </li>
          ))}

          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-3">Nicio categorie nu se potrivește.</li>
          )}
        </ul>
      )}
    </div>
  );
}
