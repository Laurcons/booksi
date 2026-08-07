import { useState } from "react";
import type { Book, ListBooksQuery } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { useBudgetSummary } from "../api/budget";
import { useStatsOverview } from "../api/stats";
import { DashboardStats } from "../components/DashboardStats";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { BookTable } from "../components/books/BookTable";
import { DeleteBookDialog } from "../components/books/DeleteBookDialog";
import { EmptyLibrary } from "../components/books/EmptyLibrary";
import { plural } from "../lib/plural";

/**
 * Sprint 1 — the library, for real. This page used to render a fixture, which
 * survived in `fixtures/books.ts` only so that the shelf and the stats bar had
 * something to draw while they waited for Sprint 8. They have real data now, so
 * the fixture is gone and nothing anywhere in the app is a mock.
 *
 * Sprint 8 adds the dashboard band above the table (S8.1, §D32) — the numbers
 * come from the API rather than from the `books` this page already holds, so
 * that they are the same numbers `/stats` shows.
 *
 * S1.6 needs no code of its own: the list comes from the API on every visit,
 * so the library is the same on any browser or device and there is no local
 * copy that could go stale.
 */
type Dialog =
  | { kind: "add" }
  | { kind: "edit"; book: Book }
  | { kind: "delete"; book: Book }
  | null;

export function LibraryPage() {
  const [query, setQuery] = useState<ListBooksQuery>({
    sort: "createdAt",
    order: "desc",
  });
  const [dialog, setDialog] = useState<Dialog>(null);

  const { data: books, isPending, isError, error, refetch } = useBooks(query);

  return (
    <div className="min-h-dvh">
      <Header onAddBook={() => setDialog({ kind: "add" })} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        <Greeting books={books} />

        {/* S8.1 — the dashboard, at the top of the screen the app opens on
            (§D32). Above the table rather than instead of it: §D28 keeps S1.2's
            table on `/`, and a summary belongs over the thing it summarises. */}
        <Dashboard />

        {isPending && <Note>Se încarcă biblioteca…</Note>}

        {isError && (
          <LoadFailure
            what="biblioteca"
            error={error}
            onRetry={() => void refetch()}
          />
        )}

        {books &&
          (books.length === 0 ? (
            <EmptyLibrary onAdd={() => setDialog({ kind: "add" })} />
          ) : (
            <BookTable
              books={books}
              query={query}
              onQueryChange={setQuery}
              onEdit={(book) => setDialog({ kind: "edit", book })}
              onDelete={(book) => setDialog({ kind: "delete", book })}
            />
          ))}
      </main>

      {dialog?.kind === "add" && <BookFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && (
        <BookFormDialog book={dialog.book} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && (
        <DeleteBookDialog book={dialog.book} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/**
 * S8.1 — the four figures, from the two endpoints that already own them.
 *
 * Neither request blanks the page if it fails, and neither shows a half-filled
 * row while it loads: four numbers where one is a spinner is worse than four
 * numbers a moment later. The library below carries the screen meanwhile, which
 * is the whole reason the dashboard is a band on `/` rather than a page of its
 * own (§D32).
 */
function Dashboard() {
  const stats = useStatsOverview();
  const budget = useBudgetSummary();

  if (stats.data === undefined || budget.data === undefined) {
    return null;
  }

  return <DashboardStats stats={stats.data} month={budget.data.month} />;
}

function Greeting({ books }: { books: Book[] | undefined }) {
  const reading = books?.filter((book) => book.status === "READING").length ?? 0;
  const waiting = books?.filter((book) => book.status === "PURCHASED").length ?? 0;

  return (
    <div>
      <h1 className="font-display text-4xl text-ink">
        Biblioteca ta<span className="text-accent">.</span>
      </h1>
      {books && books.length > 0 && (
        <p className="mt-2 text-ink-2">
          Ai {plural(reading, "carte începută", "cărți începute")} și{" "}
          {plural(waiting, "carte care te așteaptă", "cărți care te așteaptă")}.
        </p>
      )}
    </div>
  );
}


