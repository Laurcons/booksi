import { GENRE_LABEL } from "@bookcsi/shared";
import type { BookWithCover } from "../lib/covers";
import { progressLabel, progressRatio } from "../lib/progress";
import { shelfRows, spineColor, spineHeight, spineWidth } from "../lib/shelf";
import { StatusPill } from "./StatusPill";

/**
 * S8.2 — the shelf. docs/DESIGN.md §Raftul: the only light surface in the app,
 * a warm wooden plank with pastel spines, and it works precisely by contrast
 * with everything else.
 *
 * The geometry lives in `lib/shelf.ts` rather than here — thickness from the
 * page count, deterministic jitter, the pastel ramp — because it is arithmetic
 * with rules behind it, and arithmetic buried in JSX is arithmetic nobody
 * checks. What is left in this file is the drawing.
 */
export function Shelf({ books }: { books: BookWithCover[] }) {
  const rows = shelfRows(books);

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-ink">
          Raftul <em className="text-accent">tău</em>
        </h2>
        <p className="text-sm text-ink-3">{books.length} cărți în bibliotecă</p>
      </div>

      <div className="rounded-xl border border-line bg-surface-1 px-6 py-8 sm:px-10">
        {rows.map((row, index) => (
          <ShelfRow
            key={row[0]?.id ?? index}
            books={row}
            last={index === rows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function ShelfRow({ books, last }: { books: BookWithCover[]; last: boolean }) {
  return (
    <div className={last ? "" : "mb-9"}>
      <div className="relative flex items-end gap-[3px] pl-3">
        {books.map((book) => (
          <Spine key={book.id} book={book} />
        ))}
      </div>
      <Plank />
    </div>
  );
}

function Spine({ book }: { book: BookWithCover }) {
  const width = spineWidth(book.totalPages);
  const height = spineHeight(book);
  const base = spineColor(book.genre);

  return (
    <div className="group relative">
      <div
        className="relative cursor-pointer rounded-t-[3px] transition-transform duration-150 ease-out group-hover:-translate-y-2.5"
        style={{
          width,
          height,
          background: `linear-gradient(90deg,
            rgba(0,0,0,.20) 0%,
            rgba(255,255,255,.12) 18%,
            rgba(255,255,255,0) 52%,
            rgba(0,0,0,.20) 100%), ${base}`,
          boxShadow: "0 2px 6px -2px rgba(0,0,0,.55)",
        }}
      >
        {/* binding bands */}
        <span className="absolute inset-x-0 top-[13%] h-px bg-[#3a2e24]/25" />
        <span className="absolute inset-x-0 top-[17%] h-px bg-[#3a2e24]/25" />
        <span className="absolute inset-x-0 bottom-[13%] h-px bg-[#3a2e24]/25" />
        <span className="absolute inset-x-0 bottom-[17%] h-px bg-[#3a2e24]/25" />

        {width >= 20 && (
          <span
            className="absolute inset-x-0 top-[24%] bottom-[24%] mx-auto flex items-center justify-center overflow-hidden text-center text-[10px] leading-tight font-medium text-[#3a2e24]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            <span className="truncate">{book.title}</span>
          </span>
        )}

        {book.favorite && (
          <span className="absolute inset-x-0 bottom-[6%] mx-auto size-1.5 rounded-full bg-[#8a6a1e]" />
        )}
      </div>

      <SpineCard book={book} />
    </div>
  );
}

/** Hover detail. A shelf you cannot read is decoration, not a library. */
function SpineCard({ book }: { book: BookWithCover }) {
  const ratio = progressRatio(book);

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-4 w-64 -translate-x-1/2 rounded-xl border border-line bg-surface-3 p-3 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100">
      <div className="flex gap-3">
        {book.cover ? (
          <img
            src={book.cover}
            alt=""
            className="h-[84px] w-14 shrink-0 rounded-[2px] object-cover"
          />
        ) : (
          <div className="grid h-[84px] w-14 shrink-0 place-items-center rounded-[2px] border border-accent/30 bg-surface-2 p-1 text-center font-display text-[9px] leading-tight text-ink-2">
            {book.title}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm text-ink">{book.title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-3">{book.author}</p>
          {book.genre && (
            <p className="mt-1.5 text-[11px] text-ink-3">{GENRE_LABEL[book.genre]}</p>
          )}
          <div className="mt-2">
            <StatusPill status={book.status} />
          </div>
        </div>
      </div>

      {book.rating !== null && (
        <div className="mt-3 flex items-center gap-2">
          <Stars value={book.rating} />
        </div>
      )}

      {book.status === "READING" && (
        <div className="mt-3">
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
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} din 5 stele`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="12" height="12" viewBox="0 0 24 24" aria-hidden>
          <path
            d="m12 2.5 2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6-4.8-4.6 6.6-.9L12 2.5Z"
            fill={star <= value ? "var(--color-accent)" : "var(--color-line)"}
          />
        </svg>
      ))}
    </span>
  );
}

/** The shelf board — the only light surface in the app. §DESIGN.md */
function Plank() {
  return (
    <div className="relative">
      <div
        className="h-2.5 rounded-[2px]"
        style={{
          background:
            "linear-gradient(180deg, #e4d2b8 0%, var(--color-wood) 55%, #c8ad8b 100%)",
          boxShadow: "inset 0 3px 5px -3px rgba(0,0,0,.45)",
        }}
      />
      <div
        className="h-[7px] rounded-b-[2px]"
        style={{
          background:
            "linear-gradient(180deg, var(--color-wood-edge) 0%, var(--color-wood-deep) 100%)",
        }}
      />
      <div className="h-7 bg-gradient-to-b from-black/45 to-transparent" />
    </div>
  );
}
