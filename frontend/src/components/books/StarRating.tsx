/**
 * S2.3 — five whole stars, no halves (docs/DESIGN.md §Stelele: `--accent` for
 * the filled ones, `--border` for the empty ones).
 *
 * Two components rather than one with an `interactive` flag, because the two
 * jobs have nothing in common underneath. Reading is a piece of text; rating is
 * a radio group, and it is a real `<input type="radio">` group so that arrow
 * keys, tab order, form reset and react-hook-form's `register` all work without
 * a line of code from us. The stars are what you see; the radios are what the
 * browser and the screen reader see.
 */

/** Not exported: a file that exports both components and constants loses fast
 *  refresh, and nothing outside needs the list. */
const RATING_VALUES = [1, 2, 3, 4, 5] as const;

const FILLED = "text-accent";
const EMPTY = "text-line";

/** The table cell and, later, the gallery card (S5.4). */
export function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    // An unrated book shows the same dash as any other empty column, not five
    // grey stars — §D5 excludes it from the average, so it is genuinely absent
    // rather than zero.
    return <span className="text-ink-3">—</span>;
  }

  return (
    <span
      className="inline-flex gap-0.5 whitespace-nowrap"
      // The stars are decoration over a number; one label beats five glyphs
      // read out one at a time.
      role="img"
      aria-label={`${rating} din 5 stele`}
    >
      {RATING_VALUES.map((value) => (
        <span key={value} aria-hidden className={value <= rating ? FILLED : EMPTY}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * The form control. `name`, `value` and `onChange` come straight from
 * react-hook-form's `register`, so the empty string is "no rating" here exactly
 * as it is everywhere else in the form.
 *
 * `inputRef` goes on **every** radio, not just the first. A radio group has one
 * value spread across several elements, and react-hook-form reads it back by
 * asking each registered element whether it is checked — hand it one ref and it
 * sees a single unchecked radio and concludes the field is empty, however many
 * stars are lit on screen.
 */
export function StarRatingInput({
  name,
  value,
  disabled = false,
  onChange,
  onBlur,
  inputRef,
}: {
  name: string;
  value: string;
  disabled?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const selected = value === "" ? 0 : Number(value);

  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
        {RATING_VALUES.map((star) => (
          <label
            key={star}
            className={
              "text-xl leading-none transition-colors duration-150 " +
              (star <= selected ? FILLED : EMPTY) +
              (disabled ? " opacity-50" : " hover:text-accent-hover")
            }
          >
            <input
              type="radio"
              name={name}
              value={String(star)}
              checked={selected === star}
              disabled={disabled}
              onChange={onChange}
              onBlur={onBlur}
              ref={inputRef}
              // Off-screen rather than `hidden`: a hidden input is not
              // focusable, and the keyboard has to be able to reach the stars.
              className="sr-only"
              aria-label={`${star} ${star === 1 ? "stea" : "stele"}`}
            />
            ★
          </label>
        ))}
      </div>

      {/* Un-rating a book has to be reachable. The API takes `null` for it at
          any status, so this is never the thing that blocks a save. */}
      <label
        className={
          "text-xs text-ink-3 transition-colors duration-150 " +
          (disabled ? "opacity-50" : "hover:text-ink-2")
        }
      >
        <input
          type="radio"
          name={name}
          value=""
          checked={value === ""}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
          ref={inputRef}
          className="sr-only"
        />
        <span className={value === "" ? "text-ink-2" : ""}>fără rating</span>
      </label>
    </div>
  );
}
