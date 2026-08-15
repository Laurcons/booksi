import { useMemo, useState, type ChangeEventHandler, type FocusEventHandler, type Ref } from "react";
import { useBooks } from "../../api/books";

/**
 * The Autor field, with a dropdown of names already in the library beneath it.
 *
 * Offered, never enforced: `author` stays the free-text column it always was
 * (there is no `Author` table), so picking a suggestion is just a shortcut for
 * typing the same string again with the same spelling. Ignoring the dropdown
 * and typing a new name works exactly as before.
 *
 * Same reasoning as `BookSelector`: a personal library is a few hundred rows,
 * so filtering the already-fetched list client-side beats a dedicated
 * endpoint and its own debounce.
 */
export function AuthorInput({
  name,
  value,
  className,
  onChange,
  onBlur,
  onSelect,
  inputRef,
}: {
  name: string;
  value: string;
  className: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onSelect: (author: string) => void;
  inputRef: Ref<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);

  const { data: books } = useBooks({ sort: "title", order: "asc" });

  const authors = useMemo(() => {
    const seen = new Set<string>();

    for (const book of books ?? []) {
      if (book.author !== null && book.author.trim() !== "") {
        seen.add(book.author);
      }
    }

    return [...seen].sort((a, b) => a.localeCompare(b, "ro"));
  }, [books]);

  const query = value.trim().toLowerCase();
  const matches =
    query === ""
      ? []
      : authors
          .filter(
            (author) =>
              author.toLowerCase() !== query && author.toLowerCase().includes(query),
          )
          .slice(0, 8);

  const choose = (author: string) => {
    setOpen(false);
    onSelect(author);
  };

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        ref={inputRef}
        autoComplete="off"
        className={className}
        onChange={(event) => {
          onChange(event);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          onBlur(event);
          setOpen(false);
        }}
      />

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface-1 shadow-lg">
          {matches.map((author) => (
            <li key={author}>
              <button
                type="button"
                // Fires before the input's own blur, which would otherwise
                // close this list before the click ever reached it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(author)}
                className="block w-full px-3 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface-3"
              >
                {author}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
