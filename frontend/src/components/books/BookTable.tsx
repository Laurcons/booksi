import type { ReactNode } from "react";
import {
  STATUS_LABEL,
  type Book,
  type BookSort,
  type ListBooksQuery,
} from "@bookcsi/shared";
import { useUpdateBook } from "../../api/books";
import { NEXT_STATUS, NEXT_STATUS_LABEL, STATUS_COLOR } from "../../lib/status";
import { CoverThumb } from "./CoverThumb";

/**
 * S1.2 — the table.
 *
 * docs/DESIGN.md §Tabelul: no vertical rules, 1px horizontal separators, 56px
 * rows so a 32×48 cover fits, numbers right-aligned with tabular figures, and
 * a sticky header. The low density is what keeps it a journal rather than a
 * spreadsheet.
 *
 * Price and rating are columns from day one and stay empty until Sprints 2–3
 * fill them, exactly as the story asks — a table that grows columns later
 * looks like a different table.
 */
export function BookTable({
  books,
  query,
  onQueryChange,
  onEdit,
  onDelete,
}: {
  books: Book[];
  query: ListBooksQuery;
  onQueryChange: (query: ListBooksQuery) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
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
            <Th align="right">Preț</Th>
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
  onEdit,
  onDelete,
}: {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateBook();
  const next = NEXT_STATUS[book.status];

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
        {book.totalPages ?? <Empty />}
      </Td>
      <Td align="right" className="tabular text-ink-2">
        {book.paidPrice === null ? <Empty /> : book.paidPrice.toFixed(2)}
      </Td>
      <Td align="right" className="tabular text-ink-2">
        {book.rating === null ? <Empty /> : `${book.rating}/5`}
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
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: book.id, input: { status: next } })
              }
              className="rounded-lg border border-accent-quiet px-2.5 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-50"
            >
              {NEXT_STATUS_LABEL[book.status]}
            </button>
          )}
          <RowAction onClick={onEdit}>Editează</RowAction>
          <RowAction onClick={onDelete}>Șterge</RowAction>
        </div>
      </Td>
    </tr>
  );
}

/**
 * The pill always carries its label — status is never conveyed by color alone
 * (docs/DESIGN.md §Statusuri).
 */
function StatusPill({ status }: { status: Book["status"] }) {
  const color = STATUS_COLOR[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {STATUS_LABEL[status]}
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
  const base = `sticky top-16 z-10 bg-surface-2 px-4 py-3 text-[11px] font-medium uppercase tracking-[.08em] text-ink-3 ${
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
