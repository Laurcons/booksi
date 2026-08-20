import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CURRENCY,
  formatMoney,
  type BudgetByMonth,
  type BudgetMonth,
} from "@bookcsi/shared";
import { monthLabel, monthTick } from "../../lib/month";
import { useT } from "../../i18n/locale-context";

/**
 * S6.2 — money spent per month, as bars.
 *
 * docs/DESIGN.md §Grafice, which defers to the dataviz method, and the specs
 * that follow from both:
 *
 * - **Bars, not a line.** Monthly spending is a magnitude per interval, not a
 *   continuous quantity — a line would draw a slope between two months that
 *   says something nobody measured.
 * - **One series, so no legend.** The heading names what is plotted; a box with
 *   a single swatch would restate it.
 * - **4px cap, square at the baseline, ≤24px thick**, with the leftover band
 *   left as air rather than fattening the bars.
 * - **Recessive grid:** hairline horizontal lines only, no plot outline, no
 *   vertical rules.
 * - **Text wears text tokens.** Only the bars carry the accent; every label,
 *   tick and value stays in ink.
 * - **Hover by default.** An SVG chart is interactive; a static one is a
 *   picture of a chart.
 *
 * The series arrives dense and oldest-first from the API (§D31) — the empty
 * months are real zeros, and dropping them would put January beside April at
 * equal width.
 *
 * Three things arrived later, all of them about a chart being readable rather
 * than merely correct: the tooltip names the month's dearest purchases instead
 * of only totalling them, a rule marks the monthly budget, and the axis says
 * what its numbers are.
 */
export function SpendChart({
  data,
  budget = null,
}: {
  data: BudgetByMonth;
  /**
   * S6.3's monthly budget, drawn across the series as a reference.
   *
   * Worth being honest about what this is: `monthlyBudget` is a single current
   * setting, not a history, so the line means "this is what you aim to spend",
   * not "this is what you had budgeted in March 2025". It is a rule, not a
   * second series — which is also why it wears an ink token rather than a chart
   * colour, and why docs/DESIGN.md's "one axis, one series" still holds.
   */
  budget?: number | null;
}) {
  const t = useT();

  // A budget above every bar would otherwise sit off the top of the plot, where
  // a reference nobody can see is worse than none.
  const showBudget = budget !== null && budget > 0;
  const ceiling = niceCeiling(
    Math.max(...data.months.map((month) => month.spent), showBudget ? budget : 0),
  );

  return (
    <section className="rounded-xl border border-line bg-surface-1 px-8 py-7">
      <h2 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        {t("chart.spend.title")}
      </h2>

      {data.months.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          {t("budget.emptyChart")}
        </p>
      ) : (
        <>
          {/* The unit, stated once. Repeating "lei" on all five ticks would
              print a constant five times on a chart docs/DESIGN.md wants
              quiet — so it sits above the axis instead, where a reader meets it
              before the first number. */}
          <p className="mt-5 text-[11px] text-ink-3">{CURRENCY}</p>

          <div className="mt-1" aria-hidden>
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
                  tickFormatter={(value: number) => String(value)}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "var(--color-ink-3)", fontSize: 12 }}
                  // Room for the budget rule when it sits above every bar.
                  domain={[0, ceiling]}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  content={<SpendTooltip />}
                />
                <Bar
                  dataKey="spent"
                  fill="var(--color-accent)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />

                {/* Dashed and in ink, so it reads as an annotation over the
                    series rather than as another thing being measured. */}
                {showBudget && (
                  <ReferenceLine
                    y={budget}
                    stroke="var(--color-ink-3)"
                    strokeDasharray="4 4"
                    label={{
                      value: "buget lunar",
                      position: "insideTopRight",
                      fill: "var(--color-ink-3)",
                      fontSize: 11,
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The chart itself is `aria-hidden`: an SVG of bars is nothing to a
              screen reader, and the numbers behind it are small enough to say
              outright. Same data, same order, no separate source of truth. */}
          <table className="sr-only">
            <caption>{t("chart.spend.title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("chart.month")}</th>
                <th scope="col">Cheltuit ({CURRENCY})</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((entry) => (
                <tr key={entry.month}>
                  <th scope="row">{monthLabel(entry.month, t)}</th>
                  <td>{formatMoney(entry.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Required by S6.2: what the chart cannot show, under the chart — and
          only when there is something it cannot show. With every purchase
          dated there is no difference to explain, and a line saying so would
          just repeat the total's own note a few pixels away. */}
      {data.undated.books > 0 && (
        <p className="mt-4 text-sm text-ink-3">
          {t("chart.spend.undated", {
            count: data.undated.books,
            amount: formatMoney(data.undated.total),
            currency: CURRENCY,
          })}
        </p>
      )}
    </section>
  );
}

/**
 * The top of the axis, rounded to a number a person would have chosen.
 *
 * Naming the domain is what makes room for the budget rule when it sits above
 * every bar, but handing Recharts the raw maximum takes its tick-picking away
 * too, and the axis ends up topped with `556.24` — a label that is exact, ugly,
 * and about nothing. Rounding up to the next half-decade puts it back to `600`
 * while keeping the headroom the rule needs.
 */
function niceCeiling(value: number): number {
  if (value <= 0) {
    return 0;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;

  return Math.ceil(value / step) * step;
}

/**
 * The default tooltip is a white card with a coloured label on it — both wrong
 * here: the surface belongs to the theme, and text never wears the series
 * colour.
 *
 * Beyond the total, the month's dearest purchases by name. A total answers how
 * much a month cost and stops there; three titles usually answer *why*, and the
 * count that follows them ("și încă 4") keeps the short list from reading as
 * the whole list.
 */
export function SpendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: BudgetMonth }[];
  label?: string;
}) {
  const t = useT();

  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  const month = payload[0].payload;
  const top = month?.top ?? [];
  const others = month?.others ?? 0;

  return (
    <div className="max-w-64 rounded-lg border border-line bg-surface-3 px-3 py-2 text-sm shadow-lg shadow-black/40">
      <p className="text-ink-3">{monthLabel(String(label), t)}</p>
      <p className="tabular text-ink">
        {formatMoney(payload[0].value ?? 0)} {CURRENCY}
      </p>

      {top.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
          {top.map((purchase) => (
            <li
              key={purchase.title}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="truncate text-ink-2">{purchase.title}</span>
              <span className="tabular shrink-0 text-ink-3">
                {formatMoney(purchase.paidPrice)}
              </span>
            </li>
          ))}

          {others > 0 && (
            /* "și altele" would hide how many are hidden, which is the one
               thing this line exists to say. */
            <li className="text-ink-3">
              {t("chart.spend.others", { count: others })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
