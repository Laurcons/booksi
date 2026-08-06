import type { WishlistSummary } from "@bookcsi/shared";
import { coverage } from "../../lib/wishlist-coverage";

/**
 * S3.3 — what the wishlist would cost, and how much of the wishlist that
 * figure actually speaks for.
 *
 * The second line is the point of the component. A total summed over the books
 * that have an estimate reads, on its own, as the price of the whole list — and
 * it is wrong by however many books were left blank. The story asks for both
 * numbers in one breath, so they are one block here and cannot be shown apart.
 *
 * docs/DESIGN.md §Cifrele din dashboard: numbers on a hairline-bordered row,
 * no card grid, no series color — this is a figure, not a chart.
 */
export function WishlistTotal({ summary }: { summary: WishlistSummary }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-8 py-7">
      <p className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        Cât m-ar costa tot
      </p>
      <p className="mt-2 font-display text-4xl text-ink tabular">
        {summary.total.toFixed(2)}{" "}
        <span className="font-sans text-2xl text-ink-2">lei</span>
      </p>
      <p className="mt-2 text-sm text-ink-3">{coverage(summary)}</p>
    </div>
  );
}
