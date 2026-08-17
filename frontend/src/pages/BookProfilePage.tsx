import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  GENRE_LABEL,
  progressLabel,
  progressRatio,
  showsProgressBar,
  type Book,
} from "@bookcsi/shared";
import { useBook, useUpdateBook } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { StatusPill } from "../components/StatusPill";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { CoverPlaceholder } from "../components/books/CoverPlaceholder";
import { DeleteBookDialog } from "../components/books/DeleteBookDialog";
import { StarRating } from "../components/books/StarRating";
import { useBookOrigin } from "../lib/book-origin";
import { apiImageSrc, CREDENTIALED_IMAGE } from "../lib/media";

/**
 * §D40 — the book's own page: everything known about it, and the description
 * underneath.
 *
 * **This supersedes the half of S8.2 that said the book's details are the edit
 * dialog.** The dialog is a form, and a form is the wrong shape for prose — a
 * synopsis of several paragraphs sitting in a `<textarea>` between the ISBN and
 * the page count is text you have to enter edit mode to read. So the two split
 * along what they are for: this screen reads, the dialog writes, and the dialog
 * is one button away from here for when reading turns into correcting.
 *
 * The description is the reason the screen exists and it is drawn as the body
 * of the page rather than as one more row in the metadata grid. Its empty state
 * is not decoration either: bookcsi never goes and fetches a description on its
 * own (§D40), so the blank is where the user is told who can.
 */
export function BookProfilePage() {
  // The route is `/books/:id`, so this is only ever absent if someone rewires
  // the route; an empty id would ask the API for `/books/` and get the listing.
  const { id = "" } = useParams<{ id: string }>();

  const { data: book, isPending, isError, error, refetch } = useBook(id);
  const origin = useBookOrigin(book);

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
        <BackLink origin={origin} />

        {isPending && <Note>Se încarcă cartea…</Note>}

        {isError && (
          <LoadFailure what="cartea" error={error} onRetry={() => void refetch()} />
        )}

        {book && <Profile book={book} />}
      </main>
    </div>
  );
}

/**
 * A `Link`, not a `button` calling `navigate`. It goes to a real path, so it
 * should behave like one: middle-click, ctrl-click and "copy link address" all
 * work, and the destination shows in the status bar before the click.
 */
function BackLink({ origin }: { origin: { to: string; label: string } }) {
  return (
    <Link
      to={origin.to}
      className="inline-flex items-center gap-2 text-sm text-ink-3 transition-colors duration-150 hover:text-ink"
    >
      <span aria-hidden>←</span>
      Înapoi la {origin.label}
    </Link>
  );
}

function Profile({ book }: { book: Book }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const origin = useBookOrigin(book);
  const navigate = useNavigate();

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Cover book={book} />
          <FavoriteToggle book={book} />
        </div>

        <div className="min-w-0 space-y-6">
          <Identity book={book} />
          <Actions
            onEdit={() => setDialog("edit")}
            onDelete={() => setDialog("delete")}
          />
          <Description text={book.description} />
          <Details book={book} />
        </div>
      </div>

      {dialog === "edit" && (
        <BookFormDialog book={book} onClose={() => setDialog(null)} />
      )}

      {/* A deleted book has no page left to stand on, so the way out is the
          way the user came in — replacing this entry rather than pushing over
          it, so that Back does not walk into a profile that 404s now. */}
      {dialog === "delete" && (
        <DeleteBookDialog
          book={book}
          onClose={() => setDialog(null)}
          onDeleted={() => void navigate(origin.to, { replace: true })}
        />
      )}
    </>
  );
}

function Cover({ book }: { book: Book }) {
  const src = apiImageSrc(book.coverUrl);

  return (
    <div className="aspect-[2/3] overflow-hidden rounded-xl border border-line bg-surface-2">
      {src === null ? (
        <CoverPlaceholder title={book.title} author={book.author} variant="card" />
      ) : (
        <img
          {...CREDENTIALED_IMAGE}
          src={src}
          // The title is the `h1` right beside it; announcing the jacket as
          // well would say the book twice.
          alt=""
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

function Identity({ book }: { book: Book }) {
  return (
    <div>
      <h1 className="font-display text-4xl text-ink">{book.title}</h1>

      {book.author !== null && (
        <p className="mt-2 text-lg text-ink-2">{book.author}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusPill status={book.status} />
        <StarRating rating={book.rating} />
        {book.genre !== null && (
          <span className="text-sm text-ink-3">{GENRE_LABEL[book.genre]}</span>
        )}
      </div>

      {/* S2.2 — same rule as everywhere else: the bar belongs to a book being
          read, and a book with no page count keeps the bare page number
          instead of a half-drawn bar standing in for an unknown (§D4). */}
      {showsProgressBar(book) && <Progress book={book} />}
    </div>
  );
}

function Progress({ book }: { book: Book }) {
  const ratio = progressRatio(book);
  const label = progressLabel(book);

  return (
    <div className="mt-5 max-w-sm">
      {ratio !== null && (
        <span
          className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
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
      <p className="tabular mt-2 text-sm text-ink-3">{label}</p>
    </div>
  );
}

/**
 * §D40. The empty state carries the actual instruction, because "no
 * description" is not a problem the user can solve by looking harder at this
 * screen: bookcsi has no button that goes and finds one. Either they write it,
 * or they ask the assistant that is already connected to the library over MCP
 * — and the second is the thing nobody would guess is possible.
 *
 * `whitespace-pre-line` so the paragraph breaks an assistant writes survive
 * the trip. The text is otherwise rendered as text: it arrives from a model
 * over the network, and anything that treated it as markup would be handing a
 * remote writer the page.
 */
function Description({ text }: { text: string | null }) {
  return (
    <section>
      <SectionTitle>Descriere</SectionTitle>

      {text === null ? (
        <p className="mt-3 max-w-prose text-sm text-ink-3">
          Cartea n-are încă o descriere. Scrie una din „Editează” — sau
          cere-i lui Claude, dacă l-ai conectat la bibliotecă, să caute despre
          ce e cartea și să ți-o completeze.
        </p>
      ) : (
        <p className="mt-3 max-w-prose whitespace-pre-line leading-relaxed text-ink-2">
          {text}
        </p>
      )}
    </section>
  );
}

/**
 * Everything else the row holds, in one grid — the "toate detaliile" half of
 * the screen.
 *
 * Absent fields are dropped rather than printed with a dash. Most books carry
 * only a handful of these (§D4 on page counts, and the same is true of the
 * publisher, the volume and the format), so a fixed grid of eleven rows would
 * be mostly empty on nearly every book.
 */
function Details({ book }: { book: Book }) {
  const rows: [string, string | null][] = [
    ["ISBN", book.isbn],
    ["Editura", book.publisher],
    ["Anul apariției", nullableNumber(book.publicationYear)],
    ["Volum", nullableNumber(book.volume)],
    ["Format", book.format],
    ["Număr de pagini", nullableNumber(book.totalPages)],
    ["Preț estimat", money(book.estimatedPrice)],
    ["Preț plătit", money(book.paidPrice)],
    ["Cumpărată", day(book.purchasedOn)],
    ["Începută", day(book.startedOn)],
    ["Terminată", day(book.finishedOn)],
    ["Adăugată", day(book.createdAt.slice(0, 10))],
  ];

  const known = rows.filter(
    (row): row is [string, string] => row[1] !== null && row[1] !== "",
  );

  return (
    <section>
      <SectionTitle>Detalii</SectionTitle>

      <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {known.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-sm text-ink-3">{label}</dt>
            <dd className="tabular text-right text-sm text-ink-2">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        Editează
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:border-status-abandoned hover:text-ink"
      >
        Șterge
      </button>
    </div>
  );
}

/**
 * S5.2 / §D30 — the same `PATCH` the gallery card's star sends, and not
 * optimistic for the same reason: the invalidated query says so a moment
 * later, and a star that lights up before the server agrees needs a way to
 * un-light itself.
 */
function FavoriteToggle({ book }: { book: Book }) {
  const update = useUpdateBook();

  return (
    <button
      type="button"
      disabled={update.isPending}
      onClick={() => update.mutate({ id: book.id, input: { favorite: !book.favorite } })}
      aria-pressed={book.favorite}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm text-ink-2 transition-colors duration-150 hover:border-accent-quiet hover:text-ink disabled:opacity-50"
    >
      <span aria-hidden className={book.favorite ? "text-accent" : "text-ink-3"}>
        {book.favorite ? "★" : "☆"}
      </span>
      {book.favorite ? "Favorită" : "Marchează favorită"}
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
      {children}
    </h2>
  );
}

function nullableNumber(value: number | null): string | null {
  return value === null ? null : String(value);
}

function money(value: number | null): string | null {
  return value === null ? null : `${value.toFixed(2)} lei`;
}

/** `YYYY-MM-DD` as a Romanian reader writes it. */
function day(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const [year, month, date] = value.split("-");

  return `${date}.${month}.${year}`;
}
