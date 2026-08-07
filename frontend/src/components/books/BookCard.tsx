import type { Book } from "@bookcsi/shared";
import { useUpdateBook } from "../../api/books";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../../lib/media";
import { progressLabel, progressRatio, showsProgressBar } from "../../lib/progress";
import { StatusPill } from "../StatusPill";
import { CoverPlaceholder } from "./CoverPlaceholder";
import { StarRating } from "./StarRating";

/**
 * S5.1 and S5.4 — one book in the gallery.
 *
 * docs/DESIGN.md §Cardul de carte: the cover is the hero (2:3, full width),
 * then the title, the author, and a metadata row with the stars and the status
 * pill. The favourite star sits over the cover's top-right corner on a dark
 * disc so that it stays legible whatever the jacket underneath it looks like,
 * and the progress bar appears **only** on a book being read — on anything else
 * it would be noise (a finished book is at 100% by definition).
 *
 * No cover-derived shadow and no cascade animation on entry: both are in the
 * "deliberately not doing this" list of the design doc, the first because
 * colour has to stay inside the cover and the second because forty cards
 * arriving in sequence is a wait, not a flourish.
 */
export function BookCard({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const src = apiImageSrc(book.coverUrl);

  return (
    /* `h-full` is what makes a row of cards line up. The grid stretches the
       `<li>` to the tallest card in its row, but the card inside it shrinks to
       its own content unless told otherwise — so a two-line title, a missing
       author or a progress bar left every card in a row ending at a different
       height. Stretching here, and pushing the metadata row down with `mt-auto`
       below, aligns the bottoms without forcing every row to the same height. */
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface-2 transition duration-150 hover:-translate-y-0.5 hover:border-accent-quiet">
      <div className="relative aspect-[2/3] shrink-0 overflow-hidden rounded-[2px]">
        {src === null ? (
          <CoverPlaceholder title={book.title} author={book.author} variant="card" />
        ) : (
          <img
            {...CREDENTIALED_IMAGE}
            src={src}
            // The title is written directly underneath, so announcing the image
            // as well would say the book twice.
            alt=""
            // Forty covers on one screen: the ones below the fold can wait.
            loading="lazy"
            className="size-full object-cover"
          />
        )}

        <FavoriteStar book={book} />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="line-clamp-2 text-left font-semibold text-ink transition-colors duration-150 hover:text-accent"
        >
          {book.title}
        </button>

        {book.author !== null && (
          <p className="line-clamp-1 text-sm text-ink-3">{book.author}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          <StarRating rating={book.rating} />
          <StatusPill status={book.status} />
        </div>

        {showsProgressBar(book) && <Progress book={book} />}
      </div>
    </article>
  );
}

/**
 * S5.2 — marking a favourite is an edit like any other (§D30), so this is the
 * same `PATCH` the table's status buttons already use rather than a route of
 * its own. Orthogonal to status (§D14): the star is offered on every card,
 * including a wishlist book nobody has bought yet.
 *
 * The write is not optimistic. A star that lights up before the server agrees
 * has to be able to un-light itself on failure, which is a second piece of
 * state saying something the invalidated list will say anyway a moment later —
 * and here the round trip is one small `PATCH`, not a page load.
 */
function FavoriteStar({ book }: { book: Book }) {
  const update = useUpdateBook();

  return (
    <button
      type="button"
      disabled={update.isPending}
      onClick={() =>
        update.mutate({ id: book.id, input: { favorite: !book.favorite } })
      }
      // A toggle, so the state belongs on the control rather than in two
      // different labels a screen reader would have to compare.
      aria-pressed={book.favorite}
      aria-label="Favorită"
      title={book.favorite ? "Scoate de la favorite" : "Marchează ca favorită"}
      className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface-0/70 text-base leading-none backdrop-blur transition-colors duration-150 hover:bg-surface-0/90 disabled:opacity-50"
    >
      <span aria-hidden className={book.favorite ? "text-accent" : "text-ink-2"}>
        {book.favorite ? "★" : "☆"}
      </span>
    </button>
  );
}

/**
 * S2.2 on the card. The percentage is derived, never stored (§D4), and a book
 * without a page count keeps the bare "pag. 143" rather than a half-drawn bar
 * standing in for an unknown.
 */
function Progress({ book }: { book: Book }) {
  const ratio = progressRatio(book);
  const label = progressLabel(book);

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {ratio !== null && (
        <span
          className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      )}
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  );
}
