import { STATUS_COLOR, STATUS_LABEL, type Status } from "../data/types";

/**
 * The pill always carries its label — status is never conveyed by color alone.
 * See docs/DESIGN.md §Statusuri.
 */
export function StatusPill({ status }: { status: Status }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
