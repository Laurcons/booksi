import {
  CURRENCY,
  formatCount,
  formatMoney,
  type BudgetSummary,
  type StatsOverview,
} from "@bookcsi/shared";
import { StatsBar } from "./StatsBar";

/**
 * S8.1 — the four figures the app opens on: books read, books in progress,
 * pages read, and what this month has cost.
 *
 * **Two sources, and that is the point of both.** The three reading figures are
 * `/stats/overview`, the same response `/stats` reads, so the number under
 * "Cărți citite" is the same number on both screens by construction rather than
 * by two implementations agreeing (§D10, S8.1). The money is
 * `/budget/summary`, which has computed the month since S6.3 — the alternative
 * would be a second endpoint summing `paidPrice`, and two of those is exactly
 * how a dashboard starts contradicting the page it summarises.
 *
 * Rating mediu is not here. It is S7.1's third figure and stays on `/stats`
 * (§D32); the fourth slot belongs to the month's spending, which is what the
 * story asks for.
 */
export function DashboardStats({
  stats,
  month,
}: {
  stats: StatsOverview;
  /** `/budget/summary`'s own month object — the same one `MonthBudget` reads. */
  month: BudgetSummary["month"];
}) {
  return (
    <StatsBar
      figures={[
        { value: formatCount(stats.booksFinished), label: "Cărți citite" },
        { value: formatCount(stats.booksReading), label: "În curs" },
        { value: formatCount(stats.pagesRead), label: "Pagini citite" },
        {
          value: `${formatMoney(month.spent)} ${CURRENCY}`,
          label: "Cheltuit luna asta",
        },
      ]}
    />
  );
}
