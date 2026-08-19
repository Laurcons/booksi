/**
 * §D42 — the search box, on every screen that lists books.
 *
 * Controlled and stateless: the page holds the text (see `useBookSearch`), so
 * a "Șterge filtrele" elsewhere on the screen can empty it. `type="search"`
 * rather than `type="text"` for the browser's own clear button — one less
 * control to draw, and the one users already look for.
 *
 * No submit, no button, no form: the list narrows as the typing pauses. That
 * is why there is nothing here to press — anything pressable would imply the
 * results were waiting for it.
 */
export function BookSearch({
  value,
  onChange,
  placeholder = "Caută după titlu, autor, editură, ISBN…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      // The label is the accessible name and the placeholder is an example;
      // a placeholder alone would leave the field unnamed once it has text.
      aria-label="Caută în bibliotecă"
      className={
        "min-w-0 rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent " +
        className
      }
    />
  );
}
