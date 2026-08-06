import type { Book } from "@bookcsi/shared";
import {
  averageRating,
  booksFinished,
  booksReading,
  totalPagesRead,
} from "../lib/stats";

interface Props {
  books: Book[];
}

/**
 * One row, separated by hairlines — not four cards. See docs/DESIGN.md
 * §Cifrele din dashboard. These are numbers, not a chart, so they carry no
 * series color.
 */
export function StatsBar({ books }: Props) {
  const avg = averageRating(books);

  const stats = [
    { value: booksFinished(books), label: "Cărți citite" },
    { value: booksReading(books), label: "În curs" },
    { value: totalPagesRead(books).toLocaleString("ro-RO"), label: "Pagini citite" },
    { value: avg ? avg.toFixed(1) : "—", label: "Rating mediu" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-y-8 rounded-xl border border-line bg-surface-1 px-8 py-7 sm:grid-cols-4 sm:gap-y-0">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={
            "flex flex-col gap-1 " +
            (i > 0 ? "sm:border-l sm:border-line sm:pl-8" : "")
          }
        >
          <dd className="tabular font-display text-4xl leading-none text-ink">
            {stat.value}
          </dd>
          <dt className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            {stat.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
