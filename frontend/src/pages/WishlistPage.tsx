import { useState } from "react";
import type { Book, ListBooksQuery } from "@bookcsi/shared";
import { useBooks, useWishlistSummary } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { BookTable } from "../components/books/BookTable";
import { DeleteBookDialog } from "../components/books/DeleteBookDialog";
import { WishlistTotal } from "../components/books/WishlistTotal";
import { useOpenBook } from "../lib/book-origin";

/**
 * Sprint 3 — the wishlist.
 *
 * Not a second library: it is `GET /books?status=WISHLIST`, the same rows in
 * the same table, and a book crosses between the two screens by changing status
 * rather than by moving anywhere (S3.1). What is genuinely its own here is the
 * total above the table (S3.3) and the money column, which shows the estimate
 * instead of what was paid — a wishlist book has not been paid for yet.
 *
 * The "Am cumpărat-o" button that empties this page lives in the table, where
 * it has been since Sprint 1; S3.4 only changed what it calls.
 */
type Dialog =
  | { kind: "add" }
  | { kind: "edit"; book: Book }
  | { kind: "delete"; book: Book }
  | null;

export function WishlistPage() {
  const [sort, setSort] = useState<Pick<ListBooksQuery, "sort" | "order">>({
    sort: "createdAt",
    order: "desc",
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const openBook = useOpenBook("wishlist");

  // The filter is not part of the sort state: it is what this page *is*, and
  // a header click must not be able to drop it. A one-element list since S5.3
  // made the parameter multi-valued (§D29) — the wire still accepts the bare
  // string, but the parsed query is an array on both sides of it.
  const query: ListBooksQuery = { ...sort, status: ["WISHLIST"] };

  const books = useBooks(query);
  const summary = useWishlistSummary();

  return (
    <div className="min-h-dvh">
      <Header onAddBook={() => setDialog({ kind: "add" })} />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div>
          <h1 className="font-display text-4xl text-ink">
            Wishlist<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-ink-2">
            Cărțile pe care vrei să le citești, separat de ce ai deja.
          </p>
        </div>

        {/* The total is only meaningful next to a list, so it follows the list
            in and out. A failure to load it is not worth an error strip of its
            own either: the wishlist itself is still perfectly usable. */}
        {summary.data && summary.data.count > 0 && (
          <WishlistTotal summary={summary.data} />
        )}

        {books.isPending && <Note>Se încarcă wishlist-ul…</Note>}

        {books.isError && (
          <LoadFailure
            what="wishlist-ul"
            error={books.error}
            onRetry={() => void books.refetch()}
          />
        )}

        {books.data &&
          (books.data.length === 0 ? (
            <EmptyWishlist onAdd={() => setDialog({ kind: "add" })} />
          ) : (
            <BookTable
              books={books.data}
              query={query}
              onQueryChange={({ sort, order }) => setSort({ sort, order })}
              onOpen={openBook}
              onEdit={(book) => setDialog({ kind: "edit", book })}
              onDelete={(book) => setDialog({ kind: "delete", book })}
              price="estimated"
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

function EmptyWishlist({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Wishlist-ul e gol</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        Adaugă o carte cu statusul „Wishlist” și trece-i prețul pe care crezi
        că-l are. Prețul e opțional — cartea poate sta aici și fără el.
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
