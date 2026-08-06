import { useState, type ReactNode } from "react";
import type { Book, BookSort, ListBooksQuery } from "@bookcsi/shared";
import { usePurchaseBook, useUpdateBook } from "../../api/books";
import {
  progressLabel,
  progressRatio,
  progressShortLabel,
  showsProgressBar,
} from "../../lib/progress";
import { NEXT_STATUS, NEXT_STATUS_LABEL } from "../../lib/status";
import { StatusPill } from "../StatusPill";
import { CoverThumb } from "./CoverThumb";
import { StarRating } from "./StarRating";
import { StartReadingDialog } from "./StartReadingDialog";

/**
 * S1.2 — the table.
 *
 * docs/DESIGN.md §Tabelul: no vertical rules, 1px horizontal separators, 56px
 * rows so a 32×48 cover fits, numbers right-aligned with tabular figures, and
 * a sticky header. The low density is what keeps it a journal rather than a
 * spreadsheet.
 *
 * Price and rating were columns from day one and stood empty on purpose, so
 * that the table Sprint 2 fills in is the same table, not a wider one. What
 * changed here is only what the cells contain: stars instead of a dash (S2.3),
 * a paid price (S2.4), and progress in place of a bare page count for whatever
 * is being read (S2.2).
 *
 * S3.1 reuses it whole for the wishlist rather than growing a second table.
 * The one difference is which price the money column holds: a wishlist book has
 * no paid price by definition, so showing that column there would be a row of
 * dashes. Same table, one prop — not a wider table with both prices in it.
 */
export function BookTable({
  books,
  query,
  onQueryChange,
  onEdit,
  onDelete,
  price = "paid",
}: {
  books: Book[];
  query: ListBooksQuery;
  onQueryChange: (query: ListBooksQuery) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  /** Which of §D6's two prices this view is about. */
  price?: PriceColumn;
}) {
  const sortBy = (sort: BookSort) => {
    // Same column flips direction; a new column starts in the direction that
    // is actually useful for it — A→Z for names, newest first for dates.
    const order =
      query.sort === sort
        ? query.order === "asc"
          ? "desc"
          : "asc"
        : sort === "createdAt"
          ? "desc"
          : "asc";

    onQueryChange({ sort, order });
  };

  return (
    // The horizontal scroll is deliberately conditional. `overflow-x: auto`
    // makes this div the nearest scroll container, and a sticky header then
    // measures `top` against *it* rather than the viewport — which pushes the
    // header 64px down over the first row. Above `lg` the table fits, so no
    // scroll container is created and the header sticks under the app bar as
    // docs/DESIGN.md asks; below it, horizontal scrolling matters more.
    <div className="rounded-xl border border-line max-lg:overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          {/* `group` so the idle sort arrows surface on hover of the header
              row rather than sitting there permanently. */}
          <tr className="group border-b border-line text-left">
            <Th className="w-14">
              <span className="sr-only">Copertă</span>
            </Th>
            <Th sort="title" query={query} onSort={sortBy}>
              Titlu
            </Th>
            <Th sort="author" query={query} onSort={sortBy}>
              Autor
            </Th>
            <Th sort="status" query={query} onSort={sortBy}>
              Status
            </Th>
            <Th align="right">Pagini</Th>
            <Th align="right">{PRICE_LABEL[price]}</Th>
            <Th align="right">Rating</Th>
            <Th sort="createdAt" query={query} onSort={sortBy} align="right">
              Adăugată
            </Th>
            <Th align="right">
              <span className="sr-only">Acțiuni</span>
            </Th>
          </tr>
        </thead>

        <tbody>
          {books.map((book) => (
            <Row
              key={book.id}
              book={book}
              price={price}
              onEdit={() => onEdit(book)}
              onDelete={() => onDelete(book)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  book,
  price,
  onEdit,
  onDelete,
}: {
  book: Book;
  price: PriceColumn;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateBook();
  const purchase = usePurchaseBook();
  const [asking, setAsking] = useState(false);
  const next = NEXT_STATUS[book.status];

  // S2.2. Starting a book with no page count is the one transition worth a
  // question; every other one stays a single click.
  const advance = () => {
    if (next === "READING" && book.totalPages === null) {
      setAsking(true);
      return;
    }

    // S3.4. "Am cumpărat-o" was already this row's button in Sprint 1, and it
    // stays one click — it just stopped being a plain status change. Buying a
    // book also dates it and carries the estimate over into what was paid, and
    // that rule belongs to the server (§D6), so the transition has its own
    // route while every other one is still a PATCH.
    if (next === "PURCHASED") {
      purchase.mutate(book.id);
      return;
    }

    if (next !== null) {
      update.mutate({ id: book.id, input: { status: next } });
    }
  };

  const advancing = update.isPending || purchase.isPending;

  return (
    <tr className="group h-14 border-b border-line last:border-b-0 transition-colors duration-150 hover:bg-surface-2">
      <Td>
        <CoverThumb title={book.title} />
      </Td>
      <Td>
        <button
          type="button"
          onClick={onEdit}
          className="text-left font-medium text-ink transition-colors duration-150 hover:text-accent"
        >
          {book.title}
        </button>
      </Td>
      <Td className="text-ink-2">{book.author ?? <Empty />}</Td>
      <Td>
        <StatusPill status={book.status} />
      </Td>
      <Td align="right" className="tabular text-ink-2">
        <Pages book={book} />
      </Td>
      <Td align="right" className="tabular text-ink-2">
        <Price value={price === "paid" ? book.paidPrice : book.estimatedPrice} />
      </Td>
      <Td align="right">
        <StarRating rating={book.rating} />
      </Td>
      <Td align="right" className="tabular whitespace-nowrap text-ink-3">
        {formatDate(book.createdAt)}
      </Td>
      <Td align="right">
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          {/* S1.4: only the next natural step is proposed here. Every other
              transition lives in the edit form, where §D12 belongs. */}
          {next && (
            <button
              type="button"
              disabled={advancing}
              onClick={advance}
              className="rounded-lg border border-accent-quiet px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-50"
            >
              {NEXT_STATUS_LABEL[book.status]}
            </button>
          )}
          <RowAction onClick={onEdit}>Editează</RowAction>
          <RowAction onClick={onDelete}>Șterge</RowAction>

          {asking && (
            <StartReadingDialog book={book} onClose={() => setAsking(false)} />
          )}
        </div>
      </Td>
    </tr>
  );
}

/**
 * S2.2 in the table. A book being read shows where it has got to; everything
 * else shows the plain page count it always showed, because progress on a book
 * nobody has opened is not information.
 *
 * The bar appears only when there is a percentage to draw. Without a page count
 * the cell falls back to "pag. 143" — §D4's frequent case, and the reason there
 * is no half-width bar standing in for an unknown.
 */
function Pages({ book }: { book: Book }) {
  if (!showsProgressBar(book)) {
    return book.totalPages ?? <Empty />;
  }

  const ratio = progressRatio(book);

  return (
    <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
      {ratio !== null && (
        <span
          className="h-1 w-16 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          // The percentage is in the label anyway; this names what it measures.
          aria-label={progressLabel(book)}
        >
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      )}
      <span className="text-ink-2">{progressShortLabel(book)}</span>
    </span>
  );
}

function Th({
  children,
  sort,
  query,
  onSort,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  sort?: BookSort;
  query?: ListBooksQuery;
  onSort?: (sort: BookSort) => void;
  align?: "left" | "right";
  className?: string;
}) {
  // Sticky sits on the cells, not on `<thead>`: with `border-collapse`, a
  // sticky thead is unreliable across engines, while sticky `th` is not.
  // `whitespace-nowrap` so a two-word header ("Preț estimat", S3.1) stays on
  // one line instead of growing the header row taller than the rows below it.
  const base = `sticky top-16 z-10 whitespace-nowrap bg-surface-2 px-4 py-3 text-[11px] font-medium uppercase tracking-[.08em] text-ink-3 ${
    align === "right" ? "text-right" : "text-left"
  } ${className}`;

  if (!sort || !query || !onSort) {
    return <th className={base}>{children}</th>;
  }

  const active = query.sort === sort;

  return (
    <th className={base} aria-sort={ariaSort(active, query.order)}>
      <button
        type="button"
        onClick={() => onSort(sort)}
        className={
          "inline-flex items-center gap-1 uppercase tracking-[.08em] transition-colors duration-150 hover:text-ink-2 " +
          (active ? "text-accent" : "")
        }
      >
        {children}
        <span aria-hidden className={active ? "" : "opacity-0 group-hover:opacity-100"}>
          {active ? (query.order === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`px-4 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}

function RowAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2 py-1.5 text-xs text-ink-3 opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-surface-3 hover:text-ink focus-visible:opacity-100"
    >
      {children}
    </button>
  );
}

/** §D6 — the two prices are different questions, so they get different headers. */
export type PriceColumn = "paid" | "estimated";

const PRICE_LABEL: Record<PriceColumn, string> = {
  paid: "Preț",
  estimated: "Preț estimat",
};

/**
 * Two decimals, always — a price is money whether or not it ends in round lei.
 * A book with no price shows the dash, not a zero: S3.2 makes the estimate
 * optional, and "I haven't decided" is not "free".
 */
function Price({ value }: { value: number | null }) {
  return value === null ? <Empty /> : <>{value.toFixed(2)}</>;
}

/** A field nobody has filled in yet, not a zero. */
function Empty() {
  return <span className="text-ink-3">—</span>;
}

function ariaSort(active: boolean, order: "asc" | "desc") {
  if (!active) {
    return "none" as const;
  }
  return order === "asc" ? ("ascending" as const) : ("descending" as const);
}

const DATE_FORMAT = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
