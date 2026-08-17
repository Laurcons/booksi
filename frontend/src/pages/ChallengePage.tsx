import { useEffect, useState, type ReactNode } from "react";
import {
  formatCount,
  GENRE_LABEL,
  progressLabel,
  progressRatio,
  type Book,
} from "@bookcsi/shared";
import { usePurchaseBook, useUpdateBook } from "../api/books";
import { useChallenge, useChallenges } from "../api/challenges";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { StatusPill } from "../components/StatusPill";
import { CoverThumb } from "../components/books/CoverThumb";
import { StartReadingDialog } from "../components/books/StartReadingDialog";
import { ChallengeEditDialog } from "../components/challenges/ChallengeEditDialog";
import { CreateChallengeDialog } from "../components/challenges/CreateChallengeDialog";
import { FinishChallengeBookDialog } from "../components/challenges/FinishChallengeBookDialog";
import { useOpenBook } from "../lib/book-origin";
import { plural } from "../lib/plural";
import { NEXT_STATUS, NEXT_STATUS_LABEL } from "../lib/status";
import { spineColor, spineHeight, spineWidth } from "../lib/shelf";

/**
 * A curated set of books against a deadline — backed for real by
 * `backend/src/challenges/` now. Started as a local-state-only mock; this
 * page fetches the first challenge on the account (the list route already
 * orders by soonest deadline first) rather than offering a switcher, since
 * nothing has asked for browsing several yet.
 *
 * The design bet from the mockup carries over unchanged: `DESIGN.md` rejects
 * badge/countdown-bar gamification as the "advertising wrapper" the app's
 * real reference material never wanted — so the hook here is still the
 * shelf's own fill-in, not a HUD bolted on top.
 */
export function ChallengePage() {
  const {
    data: challenges,
    isPending: listPending,
    isError: listError,
    error: listErr,
    refetch: refetchList,
  } = useChallenges();

  const activeId = challenges?.[0]?.id;
  const {
    data: challenge,
    isPending: detailPending,
    isError: detailError,
    error: detailErr,
    refetch: refetchDetail,
  } = useChallenge(activeId);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const openBook = useOpenBook("provocare");

  if (listPending) {
    return (
      <Page>
        <Note>Se încarcă provocarea…</Note>
      </Page>
    );
  }

  if (listError) {
    return (
      <Page>
        <LoadFailure what="provocarea" error={listErr} onRetry={() => void refetchList()} />
      </Page>
    );
  }

  if (activeId === undefined) {
    return (
      <Page>
        <EmptyChallenge onCreate={() => setCreating(true)} />
        {creating && <CreateChallengeDialog onClose={() => setCreating(false)} />}
      </Page>
    );
  }

  if (detailPending || challenge === undefined) {
    return (
      <Page>
        <Note>Se încarcă provocarea…</Note>
      </Page>
    );
  }

  if (detailError) {
    return (
      <Page>
        <LoadFailure what="provocarea" error={detailErr} onRetry={() => void refetchDetail()} />
      </Page>
    );
  }

  const finished = challenge.books.filter((b) => b.status === "FINISHED").length;
  const total = challenge.books.length;
  const done = total > 0 && finished === total;

  const pages = pagesProgress(challenge.books);
  // Page-weighted when at least one book in the challenge has a page count —
  // finishing a 200-page book and a 900-page book stop being worth the same
  // fifth of the bar. Falls back to the whole-book ratio when none of them
  // do, which is the only case where "pages" would mean dividing by zero.
  const hasPageData = pages.total > 0;
  const progressRatioValue = hasPageData ? pages.ratio : total === 0 ? 0 : finished / total;
  const progressLabelText = hasPageData ? "Pagini citite" : "Cărți";
  const progressCaption = hasPageData
    ? `${formatCount(pages.read)} din ${formatCount(pages.total)} pagini`
    : undefined;

  const startMs = new Date(challenge.createdAt).getTime();
  const deadlineMs = new Date(`${challenge.deadline}T23:59:59`).getTime();
  const nowMs = Date.now();
  const daysLeft = Math.max(0, Math.ceil((deadlineMs - nowMs) / 86_400_000));
  const timeRatio =
    deadlineMs === startMs ? 1 : Math.min(1, Math.max(0, (nowMs - startMs) / (deadlineMs - startMs)));
  const deadlineLabel = new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${challenge.deadline}T00:00:00`));

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">
            {challenge.title}
            <span className="text-accent">.</span>
          </h1>
          {challenge.description !== null && challenge.description !== "" && (
            <p className="mt-2 max-w-xl text-ink-2">{challenge.description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-150 hover:border-accent-quiet hover:text-ink"
        >
          Editează provocarea
        </button>
      </div>

      <ChallengeHero
        finished={finished}
        total={total}
        progressLabel={progressLabelText}
        progressPercent={progressRatioValue}
        progressCaption={progressCaption}
        missingPageCounts={pages.missing}
        done={done}
        timeRatio={timeRatio}
        daysLeft={daysLeft}
        deadlineLabel={deadlineLabel}
      />

      {total === 0 ? (
        <Note>
          Nicio carte încă. „Editează provocarea” ca să adaugi una din bibliotecă.
        </Note>
      ) : (
        <>
          <ChallengeShelf books={challenge.books} onOpen={openBook} />

          <div>
            <p className="mb-3 text-sm text-ink-3">{plural(total, "carte", "cărți")} în provocare</p>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-1">
              {challenge.books.map((b) => (
                <ChallengeBookRow key={b.id} book={b} onOpen={() => openBook(b)} />
              ))}
            </div>
          </div>
        </>
      )}

      {editing && (
        <ChallengeEditDialog
          challenge={challenge}
          onClose={() => setEditing(false)}
          onDeleted={() => setEditing(false)}
        />
      )}

    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">{children}</main>
    </div>
  );
}

function EmptyChallenge({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Nicio provocare încă</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        O provocare e un set de cărți și un termen — un raft care se umple pe
        măsură ce citești.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        Creează o provocare
      </button>
    </div>
  );
}

function ChallengeHero({
  finished,
  total,
  progressLabel,
  progressPercent,
  progressCaption,
  missingPageCounts,
  done,
  timeRatio,
  daysLeft,
  deadlineLabel,
}: {
  finished: number;
  total: number;
  progressLabel: string;
  progressPercent: number;
  progressCaption?: string;
  missingPageCounts: number;
  done: boolean;
  timeRatio: number;
  daysLeft: number;
  deadlineLabel: string;
}) {
  // Same scale, same bar height, stacked — the point is that the two lengths
  // read as one comparison. Longer top bar than bottom: ahead of pace.
  const behind = timeRatio - progressPercent > 0.05;

  return (
    <div className="flex flex-col gap-8 rounded-xl border border-line bg-surface-1 px-8 py-7 sm:flex-row sm:items-center">
      <div className="shrink-0">
        <p className="tabular font-display text-5xl leading-none text-ink">
          {finished} din {total}
        </p>
        <p className="mt-2 text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          cărți terminate
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <ProgressRow
          label={progressLabel}
          percent={progressPercent}
          barClassName="bg-accent"
          caption={progressCaption}
        />
        <ProgressRow label="Timp scurs" percent={timeRatio} barClassName="bg-ink-3/50" />
        {!done && total > 0 && (
          <p className="text-xs text-ink-3">
            {behind ? "Ceva mai puțin citit decât timpul scurs." : "Conform sau înaintea termenului."}
          </p>
        )}
        {missingPageCounts > 0 && (
          <p className="text-xs text-ink-3">
            {plural(missingPageCounts, "carte nu are", "cărți nu au")} număr de pagini — nu
            intră în calculul paginilor.
          </p>
        )}
      </div>

      <div className="shrink-0 border-line sm:border-l sm:pl-8">
        {done ? (
          <p className="font-display text-2xl text-accent">Provocare încheiată.</p>
        ) : (
          <>
            <p className="tabular font-display text-3xl leading-none text-ink">{daysLeft}</p>
            <p className="mt-2 text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
              {plural(daysLeft, "zi rămasă", "zile rămase")}
            </p>
            <p className="mt-1 text-xs text-ink-3">până pe {deadlineLabel}</p>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  percent,
  barClassName,
  caption,
}: {
  label: string;
  percent: number;
  barClassName: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-ink-3">
        <span>{label}</span>
        <span className="tabular">{Math.round(percent * 100)}%</span>
      </div>
      <div
        className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={Math.round(percent * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={"h-full rounded-full transition-[width] duration-500 ease-out " + barClassName}
          style={{ width: `${percent * 100}%` }}
        />
      </div>
      {caption !== undefined && (
        <p className="tabular mt-1 text-[11px] text-ink-3">{caption}</p>
      )}
    </div>
  );
}

/**
 * The pages-weighted version of "how much of the challenge is done." A book
 * without a page count (§D4's ordinary case) simply cannot answer that
 * question, so it is excluded from both sums here — `missing` is how many,
 * for the caveat line rather than a silently wrong denominator.
 *
 * A `FINISHED` book counts as its full `totalPages` regardless of what
 * `pagesRead` happens to hold: the status already says it is done, and nobody
 * finishing a book they tracked loosely should watch this bar undercount it.
 */
function pagesProgress(books: Book[]): {
  ratio: number;
  read: number;
  total: number;
  missing: number;
} {
  const known = books.filter(
    (book): book is Book & { totalPages: number } => book.totalPages !== null,
  );

  const read = known.reduce((sum, book) => {
    const effective =
      book.status === "FINISHED"
        ? book.totalPages
        : Math.min(Math.max(book.pagesRead, 0), book.totalPages);
    return sum + effective;
  }, 0);
  const total = known.reduce((sum, book) => sum + book.totalPages, 0);

  return {
    ratio: total === 0 ? 0 : read / total,
    read,
    total,
    missing: books.length - known.length,
  };
}

/**
 * Two fixes from the design conversation, both structural rather than
 * cosmetic:
 *
 * 1. **Titles were landing on different lines.** `spineHeight()` varies with
 *    page count (§`lib/shelf.ts`), and the caption used to sit directly below
 *    each spine — so a doorstop's caption trailed lower than a novella's. Every
 *    spine now sits inside a fixed-height slot (`slotHeight`, the tallest
 *    spine in this set) and is bottom-aligned within it, so every caption
 *    starts from the same y regardless of which book is tallest.
 * 2. **No horizontal scroll on narrow screens.** `flex-wrap` lets the row fold
 *    onto a second line instead; each spine carries its own small plank
 *    segment rather than relying on one continuous board under a single row,
 *    which is what makes wrapping possible without the shelf looking broken.
 */
function ChallengeShelf({
  books,
  onOpen,
}: {
  books: Book[];
  onOpen: (book: Book) => void;
}) {
  const slotHeight = Math.max(...books.map((b) => spineHeight(b)));

  return (
    <div className="rounded-xl border border-line bg-surface-1 px-5 py-8 sm:px-8">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-7 sm:gap-x-7">
        {books.map((b) => (
          <ChallengeSpine key={b.id} book={b} slotHeight={slotHeight} onOpen={() => onOpen(b)} />
        ))}
      </div>
    </div>
  );
}

function ChallengeSpine({
  book,
  slotHeight,
  onOpen,
}: {
  book: Book;
  slotHeight: number;
  onOpen: () => void;
}) {
  const width = spineWidth(book.totalPages);
  const height = spineHeight(book);
  const color = spineColor(book.genre);
  const ratio = progressRatio(book);

  const finished = book.status === "FINISHED";
  const reading = book.status === "READING";

  return (
    <div className="flex w-16 flex-col items-center">
      {/* The fixed-height slot: every spine rests on the same baseline here,
          however tall the book actually is. */}
      <div className="flex items-end justify-center" style={{ height: slotHeight }}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={book.author === null ? book.title : `${book.title}, ${book.author}`}
          className="relative block rounded-t-[3px] transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{
            width,
            height,
            background: finished
              ? `linear-gradient(90deg,
                  rgba(0,0,0,.20) 0%,
                  rgba(255,255,255,.12) 18%,
                  rgba(255,255,255,0) 52%,
                  rgba(0,0,0,.20) 100%), ${color}`
              : "transparent",
            border: finished ? "none" : `2px solid ${reading ? color : "var(--color-line)"}`,
            boxShadow: finished ? "0 2px 6px -2px rgba(0,0,0,.55)" : "none",
          }}
        >
          {/* Not started yet: an outline only — the reserved slot on the shelf. */}
          {reading && ratio !== null && (
            <div
              className="absolute inset-x-0 bottom-0 rounded-b-[1px]"
              style={{ height: `${ratio * 100}%`, background: color, opacity: 0.5 }}
            />
          )}
        </button>
      </div>

      <MiniPlank />

      <p
        className="mt-2 w-full truncate text-center text-[11px] text-ink-3"
        title={book.title}
      >
        {finished && <span className="text-accent">✓ </span>}
        {book.title}
      </p>
    </div>
  );
}

/** One book's share of shelf board — sized to its own column, not the whole
 * row, which is what lets the shelf wrap onto a second line on a phone
 * without a plank segment floating unattached to its spine. */
function MiniPlank() {
  return (
    <div className="relative mt-1 w-full">
      <div
        className="h-[5px] rounded-[1px]"
        style={{
          background:
            "linear-gradient(180deg, #e4d2b8 0%, var(--color-wood) 55%, #c8ad8b 100%)",
          boxShadow: "inset 0 2px 3px -2px rgba(0,0,0,.45)",
        }}
      />
      <div
        className="h-[3px] rounded-b-[1px]"
        style={{
          background:
            "linear-gradient(180deg, var(--color-wood-edge) 0%, var(--color-wood-deep) 100%)",
        }}
      />
    </div>
  );
}

/**
 * Owns its own advance/finish/start state, same shape as `BookTable`'s
 * private `useAdvance` — but the `READING → FINISHED` step opens
 * `FinishChallengeBookDialog` instead of firing the PATCH directly, which is
 * the one place a challenge's next-step button means something different from
 * the rest of the app's.
 */
function ChallengeBookRow({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const update = useUpdateBook();
  const purchase = usePurchaseBook();
  const [asking, setAsking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const next = NEXT_STATUS[book.status];
  const advancing = update.isPending || purchase.isPending;

  const advance = () => {
    if (next === "READING" && book.totalPages === null) {
      setAsking(true);
      return;
    }
    if (next === "READING") {
      update.mutate({ id: book.id, input: { status: "READING" } });
      return;
    }
    if (next === "PURCHASED") {
      purchase.mutate(book.id);
      return;
    }
    if (next === "FINISHED") {
      setFinishing(true);
    }
  };

  return (
    <>
      {/* `flex-wrap`: below `sm` the title column and the pill/button group no
          longer fit on one line — wrapping lets the status/action pair drop
          to their own line instead of squeezing the title down to a sliver. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <CoverThumb title={book.title} coverUrl={book.coverUrl} />

        <div className="min-w-[160px] flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-left font-medium text-ink transition-colors duration-150 hover:text-accent"
          >
            {book.title}
          </button>
          <p className="truncate text-sm text-ink-3">
            {book.author}
            {book.genre !== null && ` · ${GENRE_LABEL[book.genre]}`}
          </p>
          {book.status === "READING" && <PageProgressEditor book={book} />}
        </div>

        <div className="ml-12 flex items-center gap-2 sm:ml-0">
          <StatusPill status={book.status} />

          {next && (
            <button
              type="button"
              disabled={advancing}
              onClick={advance}
              className="shrink-0 rounded-lg border border-accent-quiet px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-50"
            >
              {NEXT_STATUS_LABEL[book.status]}
            </button>
          )}
        </div>
      </div>

      {asking && <StartReadingDialog book={book} onClose={() => setAsking(false)} />}
      {finishing && (
        <FinishChallengeBookDialog book={book} onClose={() => setFinishing(false)} />
      )}
    </>
  );
}

/**
 * The bespoke, challenge-only control from the design conversation: editing
 * the current page directly in the row, rather than through
 * the book's own page (which stays one click away, via the
 * title/spine — this is the quick path for the one field a challenge asks
 * you to touch most often).
 */
function PageProgressEditor({ book }: { book: Book }) {
  const update = useUpdateBook();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(book.pagesRead));

  // The row's own PATCH (or a finish elsewhere) can change `pagesRead` out
  // from under an editor that is not currently open.
  useEffect(() => {
    if (!editing) {
      setValue(String(book.pagesRead));
    }
  }, [book.pagesRead, editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tabular mt-0.5 block text-left text-xs text-ink-3 underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-ink-2"
      >
        {progressLabel(book)} · schimbă pagina
      </button>
    );
  }

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0;

  const save = () => {
    if (!valid) {
      return;
    }
    update.mutate(
      { id: book.id, input: { pagesRead: parsed } },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="mt-1 flex items-center gap-1.5"
    >
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
        aria-label="Pagina curentă"
        className="tabular w-20 rounded-md border border-line bg-surface-1 px-2 py-1 text-xs text-ink outline-none transition-colors duration-150 focus:border-accent"
      />
      <button
        type="submit"
        disabled={!valid || update.isPending}
        className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
      >
        Salvează
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(String(book.pagesRead));
        }}
        className="text-xs text-ink-3 hover:text-ink-2"
      >
        Renunță
      </button>
    </form>
  );
}
