import { formatCount, type StatsOverview } from "@bookcsi/shared";
import { useLocale } from "../../i18n/locale-context";
import { StatsBar } from "../StatsBar";

/**
 * S7.1 — the three general figures, exactly the three the story names.
 *
 * `booksReading` comes back in the same response and is deliberately not shown
 * here: it is the dashboard's second figure (S8.1), and this page is about what
 * has been read rather than what is open on the nightstand.
 */
export function ReadingStats({ stats }: { stats: StatsOverview }) {
  const { locale, t } = useLocale();

  return (
    <StatsBar
      figures={[
        {
          value: formatCount(stats.booksFinished, locale),
          label: t("stats.booksFinished"),
        },
        {
          value: formatCount(stats.pagesRead, locale),
          label: t("stats.pagesRead"),
        },
        {
          value: formatRating(stats.averageRating),
          label: t("stats.averageRating"),
        },
      ]}
    />
  );
}

/**
 * An em dash for "nothing rated yet", never a 0.
 *
 * The average is over rated books alone, so with none rated there is no average
 * to print — and a zero in a slot labelled "rating mediu" reads as a verdict
 * rather than as an absence. One decimal: the scale is whole stars (§S2.3), so
 * a second decimal would claim a precision the input never had.
 */
function formatRating(rating: number | null): string {
  return rating === null ? "—" : rating.toFixed(1);
}
