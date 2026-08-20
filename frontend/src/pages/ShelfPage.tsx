import { useState } from "react";
import type { ListBooksQuery, Status } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { Shelf } from "../components/Shelf";
import { useOpenBook } from "../lib/book-origin";
import { SHELF_ORDERS, type ShelfOrder } from "../lib/shelf";
import { useT } from "../i18n/locale-context";
import type { MessageKey } from "../i18n/catalog";

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

const ORDER_LABEL: Record<ShelfOrder, MessageKey> = {
  purchased: "page.shelf.byPurchase",
  alphabetical: "page.shelf.alphabetical",
};

function queryFor(order: ShelfOrder): ListBooksQuery {
  return { ...SHELF_ORDERS[order], status: OWNED };
}

export function ShelfPage() {
  const t = useT();
  const [order, setOrder] = useState<ShelfOrder>("purchased");
  const openBook = useOpenBook("origin.shelf");

  const { data: books, isPending, isError, error, refetch } = useBooks(
    queryFor(order),
  );

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-ink">
              {t("nav.shelf")}<span className="text-accent">.</span>
            </h1>
            <p className="mt-2 text-ink-2">
              {t("page.shelf.blurb")}
            </p>
          </div>

          <OrderPicker order={order} onChange={setOrder} />
        </div>

        {isPending && <Note>{t("loading.shelf")}</Note>}

        {isError && (
          <LoadFailure
            what={t("what.shelf")}
            error={error}
            onRetry={() => void refetch()}
          />
        )}

        {books && books.length > 0 && (
          <>
            <p className="text-sm text-ink-3">
              {t("shelf.count", { count: books.length })}
            </p>

            <Shelf books={books} onOpen={openBook} />
          </>
        )}

        {/* An empty shelf is not an empty library: everything owned could be on
            the wishlist still, which is a shelf with nothing on it rather than
            a library with nothing in it. */}
        {books && books.length === 0 && <EmptyShelf />}
      </main>

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
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("page.shelf.order")}
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
  const t = useT();
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">{t("page.shelf.emptyTitle")}</p>
      <p className="mx-auto mt-3 max-w-sm text-sm text-ink-2">
        {t("page.shelf.empty")}
      </p>
    </div>
  );
}
