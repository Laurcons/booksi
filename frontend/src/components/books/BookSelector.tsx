import { useState } from "react";
import type { Book } from "@bookcsi/shared";
import { useBooks } from "../../api/books";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";
import { useBookSearch } from "../../lib/use-book-search";
import { StatusPill } from "../StatusPill";
import { CoverPlaceholder } from "./CoverPlaceholder";
import { CoverThumb } from "./CoverThumb";

type View = "table" | "gallery";

/**
 * A searchable, multiselect picker over the whole library — table or
 * gallery, same choice `/gallery` and `/` themselves offer. Built for
 * `ChallengeEditDialog`'s book membership, but knows nothing about
 * challenges: it owns its own fetch and renders a checkbox per book, and the
 * caller decides what checking one means. Standalone on purpose, so the next
 * place that needs "pick some books from the library" does not rebuild this.
 *
 * There is no Add/Remove action here, only the checkbox — `selectedIds` is
 * the caller's source of truth, and every toggle takes effect immediately
 * (the same convention as the favourite star or a status transition
 * elsewhere in the app, never a pending change waiting on a save button).
 */
export function BookSelector({
  selectedIds,
  onToggle,
}: {
  selectedIds: ReadonlySet<string>;
  onToggle: (book: Book) => void;
}) {
  const [view, setView] = useState<View>("table");
  const { search, setSearch, q } = useBookSearch();

  /**
   * §D42 — the same search the rest of the app runs, rather than the
   * `title || author` pass this component used to do over the loaded list.
   *
   * The old one was cheap and instant, and it was also quietly *different*:
   * `toLowerCase()` folds case but not diacritics, so once the API started
   * matching "sarpe" against "Șarpe" this box would have been the one place
   * that did not. It also could not see the publisher, the ISBN or the
   * description. One rule, one place — and the debounce plus the query cache
   * keep it to one request per pause.
   */
  const { data: books, isPending, isError } = useBooks({
    sort: "title",
    order: "asc",
    q,
  });
  const found = books ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Caută după titlu, autor, editură, ISBN…"
          aria-label="Caută cărți"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
        />
        <ViewToggle view={view} onChange={setView} />
      </div>

      {isPending && <p className="text-sm text-ink-3">Se încarcă biblioteca…</p>}
      {isError && (
        <p className="text-sm text-status-abandoned">Nu am putut încărca biblioteca.</p>
      )}

      {!isPending && !isError && found.length === 0 && (
        <p className="rounded-lg border border-line px-3 py-6 text-center text-sm text-ink-3">
          {search.trim() === "" ? "Nicio carte în bibliotecă." : `Nimic pentru „${search.trim()}”.`}
        </p>
      )}

      {!isPending && found.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
          {view === "table" ? (
            <TableView books={found} selectedIds={selectedIds} onToggle={onToggle} />
          ) : (
            <GalleryView books={found} selectedIds={selectedIds} onToggle={onToggle} />
          )}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div
      role="group"
      aria-label="Mod de afișare"
      className="flex shrink-0 rounded-lg border border-line bg-surface-1 p-1"
    >
      {(["table", "gallery"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={view === option}
          className={
            "rounded-md px-3 py-1.5 text-sm transition-colors duration-150 " +
            (view === option ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2")
          }
        >
          {option === "table" ? "Tabel" : "Galerie"}
        </button>
      ))}
    </div>
  );
}

function TableView({
  books,
  selectedIds,
  onToggle,
}: {
  books: Book[];
  selectedIds: ReadonlySet<string>;
  onToggle: (book: Book) => void;
}) {
  return (
    <div className="divide-y divide-line">
      {books.map((book) => (
        <label
          key={book.id}
          className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-surface-3"
        >
          <input
            type="checkbox"
            checked={selectedIds.has(book.id)}
            onChange={() => onToggle(book)}
            className="size-4 shrink-0 accent-[var(--color-accent)]"
          />
          <CoverThumb title={book.title} coverUrl={book.coverUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{book.title}</p>
            <p className="truncate text-xs text-ink-3">{book.author ?? "—"}</p>
          </div>
          <StatusPill status={book.status} />
        </label>
      ))}
    </div>
  );
}

function GalleryView({
  books,
  selectedIds,
  onToggle,
}: {
  books: Book[];
  selectedIds: ReadonlySet<string>;
  onToggle: (book: Book) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
      {books.map((book) => {
        const checked = selectedIds.has(book.id);
        const src = apiImageSrc(book.coverUrl);

        return (
          <label
            key={book.id}
            className={
              "relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors duration-150 " +
              (checked ? "border-accent" : "border-line hover:border-accent-quiet")
            }
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(book)}
              // Off-screen, not `hidden`: the whole card is the label, but the
              // checkbox itself must stay focusable and screen-reader visible.
              className="sr-only"
            />
            <div className="relative aspect-[2/3] w-full overflow-hidden">
              {src === null ? (
                <CoverPlaceholder title={book.title} author={book.author} variant="card" />
              ) : (
                <img
                  {...CREDENTIALED_IMAGE}
                  src={src}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              )}
              <span
                aria-hidden
                className={
                  "absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border text-[10px] leading-none " +
                  (checked
                    ? "border-accent bg-accent text-surface-0"
                    : "border-line bg-surface-0/70 text-transparent")
                }
              >
                ✓
              </span>
            </div>
            <p className="truncate px-2 py-1.5 text-xs font-medium text-ink">{book.title}</p>
          </label>
        );
      })}
    </div>
  );
}
