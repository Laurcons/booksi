import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BudgetByMonth } from "@bookcsi/shared";
import { monthLabel, monthTick } from "../../lib/month";
import { CURRENCY, formatMoney } from "../../lib/money";
import { plural } from "../../lib/plural";

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
 */
export function SpendChart({ data }: { data: BudgetByMonth }) {
  return (
    <section className="rounded-xl border border-line bg-surface-1 px-8 py-7">
      <h2 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        Cheltuieli pe luni
      </h2>

      {data.months.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          Niciun grafic încă: nicio carte cumpărată n-are dată de cumpărare.
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
                  tickFormatter={monthTick}
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
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The chart itself is `aria-hidden`: an SVG of bars is nothing to a
              screen reader, and the numbers behind it are small enough to say
              outright. Same data, same order, no separate source of truth. */}
          <table className="sr-only">
            <caption>Cheltuieli pe luni</caption>
            <thead>
              <tr>
                <th scope="col">Luna</th>
                <th scope="col">Cheltuit ({CURRENCY})</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((entry) => (
                <tr key={entry.month}>
                  <th scope="row">{monthLabel(entry.month)}</th>
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
          {plural(data.undated.books, "carte n-are", "cărți n-au")} dată de
          cumpărare ({formatMoney(data.undated.total)} {CURRENCY}), deci nu apar
          în grafic — sunt însă în totalul de sus.
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
function SpendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (active !== true || payload === undefined || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-line bg-surface-3 px-3 py-2 text-sm shadow-lg shadow-black/40">
      <p className="text-ink-3">{monthLabel(String(label))}</p>
      <p className="tabular text-ink">
        {formatMoney(payload[0].value ?? 0)} {CURRENCY}
      </p>
    </div>
  );
}
