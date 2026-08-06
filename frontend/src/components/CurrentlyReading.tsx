import type { Book } from "../data/types";
import { progress } from "../data/stats";

/**
 * A small strip so the page has somewhere to go after the shelf. The progress
 * bar shows only for books that are being read — §S2.2.
 */
export function CurrentlyReading({ books }: { books: Book[] }) {
  const reading = books.filter((b) => b.status === "READING");
  if (reading.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
        Citesc acum
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {reading.map((book) => {
          const p = progress(book);
          return (
            <article
              key={book.id}
              className="flex gap-4 rounded-xl border border-line bg-surface-1 p-4 transition-colors duration-150 hover:border-accent-quiet"
            >
              {book.cover && (
                <img
                  src={book.cover}
                  alt=""
                  className="h-[96px] w-16 shrink-0 rounded-[2px] object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-display text-base text-ink">
                  {book.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-3">{book.author}</p>

                <div className="mt-auto">
                  <div className="h-1 overflow-hidden rounded-full bg-surface-0">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: p ? `${p * 100}%` : 0 }}
                    />
                  </div>
                  <p className="tabular mt-1.5 text-[11px] text-ink-3">
                    {p
                      ? `${Math.round(p * 100)}% — pag. ${book.pagesRead} din ${book.totalPages}`
                      : `pag. ${book.pagesRead}`}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
