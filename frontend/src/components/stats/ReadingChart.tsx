import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatsByMonth } from "@bookcsi/shared";
import { monthLabel, monthTick } from "../../lib/month";
import { useT } from "../../i18n/locale-context";

/**
 * S7.2 — books finished per month, as bars.
 *
 * docs/DESIGN.md §Grafice names this chart alongside S6.2's and gives them the
 * same specification, so this is deliberately `SpendChart` with a different
 * series rather than a second visual idea:
 *
 * - **Bars, not a line.** Books finished in a month is a magnitude per
 *   interval; a line would draw a slope between two months that says something
 *   nobody measured.
 * - **One series, so no legend**, a **recessive grid** of horizontal hairlines,
 *   and **text in ink tokens** — only the bars carry the accent.
 * - **Whole numbers on the axis.** Half a book was never finished, and recharts
 *   will happily tick 0.5 on a range that small.
 * - **One axis, never two.** DESIGN.md rules out overlaying "bani cheltuiți" on
 *   "cărți citite": if both are wanted, they are two charts, which is exactly
 *   what this and `SpendChart` are.
 *
 * The series arrives dense and oldest-first from the API, like the budget's: a
 * month with nothing finished in it is a real zero, and dropping the row would
 * put January beside April at equal width.
 */
export function ReadingChart({ data }: { data: StatsByMonth }) {
  const t = useT();

  return (
    <section className="rounded-xl border border-line bg-surface-1 px-8 py-7">
      <h2 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        {t("chart.reading.title")}
      </h2>

      {data.months.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          {t("chart.reading.empty")}
        </p>
      ) : (
        <>
          <div className="mt-5" aria-hidden>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.months} barCategoryGap={2}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-line)"
                  strokeDasharray=""
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(month: string) => monthTick(month, t)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "var(--color-ink-3)", fontSize: 12 }}
                />
                <YAxis
                  // `allowDecimals` off for the reason above: a tick reading
                  // "1.5 cărți" is a chart contradicting its own units.
                  allowDecimals={false}
                  tickFormatter={(value: number) => String(value)}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: "var(--color-ink-3)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  content={<ReadingTooltip />}
                />
                <Bar
                  dataKey="finished"
                  fill="var(--color-accent)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The chart itself is `aria-hidden`: an SVG of bars is nothing to a
              screen reader, and the numbers behind it are small enough to say
              outright. Same data, same order, no separate source of truth. */}
          <table className="sr-only">
            <caption>{t("chart.reading.title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("chart.month")}</th>
                <th scope="col">{t("chart.reading.column")}</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((entry) => (
                <tr key={entry.month}>
                  <th scope="row">{monthLabel(entry.month, t)}</th>
                  <td>{entry.finished}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Required by S7.2 in as many words: the books the chart leaves out,
          counted out loud. Only when there are some — with every finish dated
          there is no difference to explain. */}
      {data.undated > 0 && (
        <p className="mt-4 text-sm text-ink-3">
          {t("chart.reading.undated", { count: data.undated })}
        </p>
      )}
    </section>
  );
}

/**
 * The default tooltip is a white card with a coloured label on it — both wrong
 * here: the surface belongs to the theme, and text never wears the series
 * colour.
 */
function ReadingTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  const t = useT();

  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  const finished = payload[0].value ?? 0;

  return (
    <div className="rounded-lg border border-line bg-surface-3 px-3 py-2 text-sm shadow-lg shadow-black/40">
      <p className="text-ink-3">{monthLabel(String(label), t)}</p>
      <p className="tabular text-ink">
        {finished === 0
          ? t("chart.reading.tooltip.none")
          : t("chart.reading.tooltip", { count: finished })}
      </p>
    </div>
  );
}
