import {
  CURRENCY,
  formatCount,
  formatMoney,
  type BudgetSummary,
  type StatsOverview,
} from "@bookcsi/shared";
import { useLocale } from "../i18n/locale-context";
import { StatsBar } from "./StatsBar";

/**
 * S8.1 — the four figures the app opens on: books read, books in progress,
 * pages read, and what this month has cost.
 *
 * **Two sources, and that is the point of both.** The three reading figures are
 * `/stats/overview`, the same response `/stats` reads, so the number under
 * `stats.booksFinished` is the same number on both screens by construction rather than
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
  const { locale, t } = useLocale();

  return (
    <StatsBar
      figures={[
        {
          value: formatCount(stats.booksFinished, locale),
          label: t("stats.booksFinished"),
        },
        { value: formatCount(stats.booksReading, locale), label: t("stats.booksReading") },
        { value: formatCount(stats.pagesRead, locale), label: t("stats.pagesRead") },
        {
          value: `${formatMoney(month.spent)} ${CURRENCY}`,
          label: t("stats.spentThisMonth"),
        },
      ]}
    />
  );
}
