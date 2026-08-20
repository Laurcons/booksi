import { useStatsByMonth, useStatsOverview } from "../api/stats";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { ReadingChart } from "../components/stats/ReadingChart";
import { ReadingStats } from "../components/stats/ReadingStats";
import { useT } from "../i18n/locale-context";

/**
 * Sprint 7 — the reading statistics.
 *
 * Its own screen, on the nav entry that has been greyed out since Sprint 1
 * (§D28). Two requests, mirroring the budget's shape: the figures and the chart
 * are separate concerns and a failure in one does not blank the other.
 *
 * Every number here is computed in SQL on request and stored nowhere — the
 * "valori derivate" list in DECISIONS.md — and the overview is the *same*
 * response the dashboard on `/` reads (S8.1), which is what makes the two
 * screens agree without either of them trying to.
 */
export function StatsPage() {
  const t = useT();
  const overview = useStatsOverview();
  const byMonth = useStatsByMonth();

  return (
    <div className="min-h-dvh">
      <Header />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div>
          <h1 className="font-display text-4xl text-ink">
            {t("nav.stats")}<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-ink-2">
            {t("page.stats.blurb")}
          </p>
        </div>

        {overview.isPending && <Note>{t("loading.stats")}</Note>}

        {overview.isError && (
          <LoadFailure
            what={t("what.stats")}
            error={overview.error}
            onRetry={() => void overview.refetch()}
          />
        )}

        {overview.data && <ReadingStats stats={overview.data} />}

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

        {byMonth.data && <ReadingChart data={byMonth.data} />}
      </main>
    </div>
  );
}
