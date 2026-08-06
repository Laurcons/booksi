import { useState } from "react";
import type { Book, ListBooksQuery } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { BookTable } from "../components/books/BookTable";
import { DeleteBookDialog } from "../components/books/DeleteBookDialog";
import { plural } from "../lib/plural";

/**
 * Sprint 1 — the library, for real. This page used to render the fixtures in
 * `data/books.ts`; those stay in the repo because the shelf (S8.2) and the
 * stats bar (S8.1) are still designed against them, but nothing on this screen
 * is a mock any more.
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

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Încă n-ai nicio carte</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        Adaugă prima carte completând titlul. Restul câmpurilor — autor, pagini,
        gen, ISBN — sunt opționale și le poți completa oricând.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
      >
        Adaugă o carte
      </button>
    </div>
  );
}

