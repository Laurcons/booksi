import { useState } from "react";
import type { Book, ListBooksQuery, Status } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { Shelf } from "../components/Shelf";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { plural } from "../lib/plural";
import { SHELF_ORDERS, type ShelfOrder } from "../lib/shelf";

/**
 * S8.2 — the shelf.
 *
 * The sixth nav entry, which carried the placeholder label "Tracker" from
 * Sprint 1 until §D32 gave it the screen it had been waiting for. Its own route
 * rather than a band on `/`: the plank is the only light surface in the app
 * (DESIGN.md §Raftul) and works by contrast — stacked over the dark table it
 * would read as a rendering accident.
 *
 * **Owned books only.** `PURCHASED`, `READING`, `FINISHED`, `ABANDONED`; a
 * wishlist entry is not on any shelf because you do not have it yet. Sent as a
 * repeated `status` parameter, which the listing route has read as a list since
 * §D29 — the shelf needs no filtering of its own and no endpoint of its own.
 */
const OWNED: Status[] = ["PURCHASED", "READING", "FINISHED", "ABANDONED"];

const ORDER_LABEL: Record<ShelfOrder, string> = {
  purchased: "După cumpărare",
  alphabetical: "Alfabetic",
};

function queryFor(order: ShelfOrder): ListBooksQuery {
  return { ...SHELF_ORDERS[order], status: OWNED };
}

export function ShelfPage() {
  const [order, setOrder] = useState<ShelfOrder>("purchased");
  const [editing, setEditing] = useState<Book | null>(null);

  const { data: books, isPending, isError, error, refetch } = useBooks(
    queryFor(order),
  );

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-ink">
              Raft<span className="text-accent">.</span>
            </h1>
            <p className="mt-2 text-ink-2">
              Cărțile pe care le ai, așa cum ar sta pe un raft adevărat.
            </p>
          </div>

          <OrderPicker order={order} onChange={setOrder} />
        </div>

        {isPending && <Note>Se încarcă raftul…</Note>}

        {isError && (
          <LoadFailure
            what="raftul"
            error={error}
            onRetry={() => void refetch()}
          />
        )}

        {books && books.length > 0 && (
          <>
            <p className="text-sm text-ink-3">
              {plural(books.length, "carte", "cărți")} pe raft
            </p>

            <Shelf books={books} onOpen={setEditing} />
          </>
        )}

        {/* An empty shelf is not an empty library: everything owned could be on
            the wishlist still, which is a shelf with nothing on it rather than
            a library with nothing in it. */}
        {books && books.length === 0 && <EmptyShelf />}
      </main>

      {/* Same dialog the gallery opens on a card (S5.1): "the book's details"
          is one screen in this app, and a second one would be a second place to
          keep the fields in step. */}
      {editing !== null && (
        <BookFormDialog book={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function OrderPicker({
  order,
  onChange,
}: {
  order: ShelfOrder;
  onChange: (order: ShelfOrder) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ordinea cărților pe raft"
      className="flex rounded-lg border border-line bg-surface-1 p-1"
    >
      {(Object.keys(ORDER_LABEL) as ShelfOrder[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={order === option}
          className={
            "rounded-md px-3 py-1.5 text-sm transition-colors duration-150 " +
            (order === option
              ? "bg-surface-3 text-ink"
              : "text-ink-3 hover:text-ink-2")
          }
        >
          {ORDER_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

function EmptyShelf() {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Raftul e gol</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        Aici ajung cărțile pe care le ai — cumpărate, în curs, terminate sau
        abandonate. Cele din wishlist încă nu-ți stau pe raft.
      </p>
    </div>
  );
}
