import type { BookWithCover } from "../lib/covers";
import { progressLabel, progressRatio } from "../lib/progress";

/**
 * A small strip so the page has somewhere to go after the shelf. The progress
 * bar shows only for books that are being read — §S2.2.
 *
 * The percentage comes from `lib/progress.ts`, the same place the table reads
 * it: this file used to compute its own, from a `progress()` that disagreed
 * with the table's about a zero page count and formatted the label a second
 * time by hand.
 */
export function CurrentlyReading({ books }: { books: BookWithCover[] }) {
  const reading = books.filter((book) => book.status === "READING");

  if (reading.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
        Citesc acum
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {reading.map((book) => {
          const ratio = progressRatio(book);

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
                    {/* No page count means no percentage — §D4 */}
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: ratio === null ? 0 : `${ratio * 100}%` }}
                    />
                  </div>
                  <p className="tabular mt-1.5 text-[11px] text-ink-3">
                    {progressLabel(book)}
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
