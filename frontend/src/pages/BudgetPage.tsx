import { useBudgetByMonth, useBudgetSummary } from "../api/budget";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { MonthBudget } from "../components/budget/MonthBudget";
import { SpendChart } from "../components/budget/SpendChart";
import { SpendTotal } from "../components/budget/SpendTotal";
import { useT } from "../i18n/locale-context";

/**
 * Sprint 6 — the budget.
 *
 * Its own screen, on the nav entry that has been greyed out since Sprint 1
 * (§D28). Two requests, not three: `/budget/summary` carries S6.1 and S6.3
 * together so that the total and the monthly figure cannot end up describing
 * different months, and `/budget/by-month` carries the chart.
 *
 * Every number here is computed in SQL on request and stored nowhere — the
 * "valori derivate" list in DECISIONS.md — so there is no cache on this page
 * that could disagree with the books it is derived from.
 */
export function BudgetPage() {
  const t = useT();
  const summary = useBudgetSummary();
  const byMonth = useBudgetByMonth();

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div>
          <h1 className="font-display text-4xl text-ink">
            {t("nav.budget")}<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-ink-2">
            {t("page.budget.blurb")}
          </p>
        </div>

        {summary.isPending && <Note>{t("loading.budget")}</Note>}

        {summary.isError && (
          <LoadFailure
            what={t("what.budget")}
            error={summary.error}
            onRetry={() => void summary.refetch()}
          />
        )}

        {/* `items-start` so each block is as tall as what it holds: stretched
            to match, the total would carry an empty half-card beside the
            budget's form. */}
        {summary.data && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <SpendTotal
              total={summary.data.total}
              undated={summary.data.undated}
            />
            <MonthBudget month={summary.data.month} />
          </div>
        )}

        {byMonth.isPending && <Note>{t("loading.chart")}</Note>}

        {/* The chart failing is not the page failing: the figures above it are
            a different request and still say something useful. */}
        {byMonth.isError && (
          <LoadFailure
            what={t("what.chart")}
            error={byMonth.error}
            onRetry={() => void byMonth.refetch()}
          />
        )}

        {/* The budget comes from the *summary* request, not the chart's — S6.3
            owns the number and there is no reason for two endpoints to report
            it. The chart simply draws nothing when that request has not landed
            yet, or when no budget was ever set. */}
        {byMonth.data && (
          <SpendChart
            data={byMonth.data}
            budget={summary.data?.month.budget ?? null}
          />
        )}
      </main>
    </div>
  );
}
