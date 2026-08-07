import { GENRE_LABEL, type Book } from "@bookcsi/shared";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../lib/media";
import { progressLabel, progressRatio } from "../lib/progress";
import {
  ROW_WIDTH,
  shelfRows,
  spineColor,
  spineHeight,
  spineWidth,
  SPINE_TITLE_WIDTH,
} from "../lib/shelf";
import { StatusPill } from "./StatusPill";

/**
 * S8.2 — the shelf. docs/DESIGN.md §Raftul: the only light surface in the app,
 * a warm wooden plank with pastel spines, and it works precisely by contrast
 * with everything else.
 *
 * The geometry lives in `lib/shelf.ts` rather than here — thickness from the
 * page count (§D33), deterministic jitter, the pastel ramp, how a row fills —
 * because it is arithmetic with rules behind it, and arithmetic buried in JSX
 * is arithmetic nobody checks. What is left in this file is the drawing.
 *
 * **A spine is a button.** The story asks for a click that opens the book, and
 * the prototype's `<div className="cursor-pointer">` had no click handler, no
 * tab stop and a hover card that a touch screen could never summon — a shelf
 * you can only read with a mouse is decoration. The card now answers to focus
 * as well as hover, and `Enter` opens the same dialog the gallery does.
 */
export function Shelf({
  books,
  onOpen,
}: {
  books: Book[];
  onOpen: (book: Book) => void;
}) {
  const rows = shelfRows(books, (book) => spineWidth(book.totalPages));

  return (
    /* The plank is a fixed width and the shelf scrolls sideways rather than
       reflowing: rows are packed to fill a plank exactly, and a plank that
       changed width on every viewport would have to repack on every resize. */
    <div className="overflow-x-auto rounded-xl border border-line bg-surface-1 px-6 py-8 sm:px-10">
      <div style={{ width: ROW_WIDTH }}>
        {rows.map((row, index) => (
          <ShelfRow
            key={row[0]?.id ?? index}
            books={row}
            last={index === rows.length - 1}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function ShelfRow({
  books,
  last,
  onOpen,
}: {
  books: Book[];
  last: boolean;
  onOpen: (book: Book) => void;
}) {
  return (
    <div className={last ? "" : "mb-9"}>
      <div className="relative flex items-end gap-[3px] pl-3">
        {books.map((book) => (
          <Spine key={book.id} book={book} onOpen={() => onOpen(book)} />
        ))}
      </div>
      <Plank />
    </div>
  );
}

function Spine({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const width = spineWidth(book.totalPages);
  const height = spineHeight(book);
  const base = spineColor(book.genre);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        // The spine carries no readable text at 14px, and none at all below
        // the threshold, so the accessible name is spelled out here.
        aria-label={
          book.author === null ? book.title : `${book.title}, ${book.author}`
        }
        className="relative block cursor-pointer rounded-t-[3px] transition-transform duration-150 ease-out group-hover:-translate-y-2.5 focus-visible:-translate-y-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
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

        {/* §D33 — a threshold that now falls inside the range, so a thin book
            really does go untitled rather than the rule never applying. */}
        {width > SPINE_TITLE_WIDTH && (
          <span
            aria-hidden
            className="absolute inset-x-0 top-[24%] bottom-[24%] mx-auto flex items-center justify-center overflow-hidden text-center text-[10px] leading-tight font-medium text-[#3a2e24]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            <span className="truncate">{book.title}</span>
          </span>
        )}

        {book.favorite && (
          <span className="absolute inset-x-0 bottom-[6%] mx-auto size-1.5 rounded-full bg-[#8a6a1e]" />
        )}
      </button>

      <SpineCard book={book} />
    </div>
  );
}

/**
 * The detail card. A shelf you cannot read is decoration, not a library — so it
 * answers to keyboard focus (`group-focus-within`) as well as to the mouse.
 * Still `pointer-events-none`: it is a label for the spine, not a second target
 * to hit, and catching the pointer would make the spine beside it unclickable.
 */
function SpineCard({ book }: { book: Book }) {
  const ratio = progressRatio(book);
  const src = apiImageSrc(book.coverUrl);

  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-4 w-64 -translate-x-1/2 rounded-xl border border-line bg-surface-3 p-3 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      <div className="flex gap-3">
        {src !== null ? (
          <img
            {...CREDENTIALED_IMAGE}
            src={src}
            alt=""
            loading="lazy"
            className="h-[84px] w-14 shrink-0 rounded-[2px] object-cover"
          />
        ) : (
          <div className="grid h-[84px] w-14 shrink-0 place-items-center rounded-[2px] border border-accent/30 bg-surface-2 p-1 text-center font-display text-[9px] leading-tight text-ink-2">
            {book.title}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm text-ink">{book.title}</p>
          {book.author !== null && (
            <p className="mt-0.5 truncate text-xs text-ink-3">{book.author}</p>
          )}
          {book.genre !== null && (
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
