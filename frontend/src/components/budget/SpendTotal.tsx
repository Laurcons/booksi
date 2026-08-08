import { CURRENCY, formatMoney, type UndatedSpend } from "@bookcsi/shared";
import { plural } from "../../lib/plural";

/**
 * S6.1 — what the library has cost so far.
 *
 * Only `paidPrice` is in this number, and that is the story's own line: a
 * wishlist estimate is a guess about a book nobody has bought (§D6).
 *
 * docs/DESIGN.md §Cifrele din dashboard: a figure, not a chart — Playfair
 * numeral, small uppercase label, hairline-bordered block, and no series colour
 * anywhere near it.
 */
export function SpendTotal({
  total,
  undated,
}: {
  total: number;
  undated: UndatedSpend;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-8 py-7">
      <p className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        Cât am cheltuit
      </p>
      <p className="mt-2 font-display text-4xl text-ink tabular">
        {formatMoney(total)}{" "}
        <span className="font-sans text-2xl text-ink-2">{CURRENCY}</span>
      </p>

      <p className="mt-2 text-sm text-ink-3">
        <UndatedNote undated={undated} />
      </p>
    </div>
  );
}

/**
 * The qualifier that keeps the total honest: how much of it is money with no
 * purchase date.
 *
 * Deliberately *not* the same sentence the chart carries. Both surfaces have to
 * mention the same books (S6.2), but printing one warning twice on one screen
 * reads as a rendering bug — so this one says what the total contains, and the
 * chart says what it cannot draw.
 *
 * Not an edge case, either way: a shelf typed in retroactively arrives as
 * `Terminat`, and only a transition into `Cumpărat` stamps a date (S1.5).
 */
function UndatedNote({ undated }: { undated: UndatedSpend }) {
  if (undated.books === 0) {
    return <>Fiecare sumă are și o dată de cumpărare.</>;
  }

  return (
    <>
      Din care {formatMoney(undated.total)} {CURRENCY} pe{" "}
      {plural(undated.books, "carte fără", "cărți fără")} dată de cumpărare.
    </>
  );
}
