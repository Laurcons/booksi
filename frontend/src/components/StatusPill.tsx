import { STATUS_LABEL, type Status } from "@bookcsi/shared";
import { STATUS_COLOR } from "../lib/status";

/**
 * The pill always carries its label — status is never conveyed by color alone.
 * See docs/DESIGN.md §Statusuri.
 *
 * `BookTable` had a private copy of this for a while, because this one was
 * typed against the mock's `Status` rather than the API's and could not be
 * handed a real book. Both now read the same enum, so there is one pill.
 */
export function StatusPill({ status }: { status: Status }) {
  const color = STATUS_COLOR[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
