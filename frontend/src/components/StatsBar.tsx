export interface Figure {
  value: string;
  label: string;
}

/**
 * How many across, once there is room. Written out as whole class names because
 * Tailwind scans the source for literals — a template string built from
 * `figures.length` would compile to a stylesheet with neither rule in it.
 */
const COLUMNS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

/**
 * The row of headline figures, drawn per docs/DESIGN.md §Cifrele din dashboard:
 * one row separated by hairlines, not four cards. Playfair numeral, small
 * uppercase label, and no series colour anywhere near it — these are numbers,
 * not a chart.
 *
 * Presentational on purpose. It used to compute its own figures from a
 * downloaded library, which was fine while it was a design study and wrong as
 * soon as it was real: §D10's aggregation rule lives in one place, on the
 * server, and the two screens that show these (`/` for S8.1, `/stats` for
 * S7.1) show overlapping subsets of the same response. What differs between
 * them is which figures, never how a figure is drawn.
 */
export function StatsBar({ figures }: { figures: Figure[] }) {
  return (
    <dl
      className={
        "grid grid-cols-2 gap-y-8 rounded-xl border border-line bg-surface-1 px-8 py-7 sm:gap-y-0 " +
        (COLUMNS[figures.length] ?? "sm:grid-cols-4")
      }
    >
      {figures.map((figure, index) => (
        <div
          key={figure.label}
          className={
            "flex flex-col gap-1 " +
            // A hairline before every figure but the first, and only once the
            // row is actually one row: stacked two-up on a phone, vertical
            // rules would cut between the wrong pairs.
            (index > 0 ? "sm:border-l sm:border-line sm:pl-8" : "")
          }
        >
          <dd className="tabular font-display text-4xl leading-none text-ink">
            {figure.value}
          </dd>
          <dt className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            {figure.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
