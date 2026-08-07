import { useState } from "react";
import type { Book, ListBooksQuery } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { BookCard } from "../components/books/BookCard";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { EmptyLibrary } from "../components/books/EmptyLibrary";
import { GalleryFilters } from "../components/books/GalleryFilters";
import { isFiltered } from "../lib/filters";
import { plural } from "../lib/plural";

/**
 * Sprint 5 — the gallery.
 *
 * A screen of its own rather than a view toggle on the library (§D28): the nav
 * has carried a greyed-out "Galerie" entry since Sprint 1, and this is the
 * sprint that lights it up. The table stays exactly where it was; the two are
 * different jobs — one to read in detail, one to recognise at a glance.
 *
 * No sort control here. S1.2 owns "the table is sortable", S5.1 and S5.3 never
 * ask for it, and the default order (newest first) is the library's own.
 */
type Dialog = { kind: "add" } | { kind: "edit"; book: Book } | null;

const INITIAL_QUERY: ListBooksQuery = { sort: "createdAt", order: "desc" };

export function GalleryPage() {
  const [query, setQuery] = useState<ListBooksQuery>(INITIAL_QUERY);
  const [dialog, setDialog] = useState<Dialog>(null);

  const { data: books, isPending, isError, error, refetch } = useBooks(query);
  const filtering = isFiltered(query);

  return (
    <div className="min-h-dvh">
      <Header onAddBook={() => setDialog({ kind: "add" })} />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div>
          <h1 className="font-display text-4xl text-ink">
            Galerie<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-ink-2">
            Cărțile tale după copertă — cum arată un raft, nu un tabel.
          </p>
        </div>

        <GalleryFilters query={query} onChange={setQuery} />

        {isPending && <Note>Se încarcă galeria…</Note>}

        {isError && (
          <LoadFailure
            what="galeria"
            error={error}
            onRetry={() => void refetch()}
          />
        )}

        {books && books.length > 0 && (
          <>
            {/* Under the filters rather than beside them: with a filter on, how
                many books survived it is the first thing worth knowing. */}
            <p className="text-sm text-ink-3">
              {plural(books.length, "carte", "cărți")}
              {filtering ? " după filtrare" : ""}
            </p>

            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {books.map((book) => (
                <li key={book.id}>
                  <BookCard
                    book={book}
                    onOpen={() => setDialog({ kind: "edit", book })}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Two different absences, and telling them apart is the whole point:
            an empty library needs a first book, an empty *filter* needs its
            filters back (§D29). */}
        {books && books.length === 0 && !filtering && (
          <EmptyLibrary onAdd={() => setDialog({ kind: "add" })} />
        )}

        {books && books.length === 0 && filtering && (
          <NothingMatches onClear={() => setQuery(INITIAL_QUERY)} />
        )}
      </main>

      {dialog?.kind === "add" && <BookFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && (
        <BookFormDialog book={dialog.book} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function NothingMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Nicio carte nu se potrivește</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        Biblioteca nu e goală — filtrele sunt prea înguste. Mai scoate unul și
        cărțile se întorc.
      </p>
      {/* Deliberately not the same words as the strip above: two buttons
          reading "Șterge filtrele" on one screen is a puzzle, and this one can
          afford to say what the user gets. */}
      <button
        type="button"
        onClick={onClear}
        className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        Arată toate cărțile
      </button>
    </div>
  );
}
