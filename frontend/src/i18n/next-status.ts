import type { Status } from "@bookcsi/shared";
import { NEXT_STATUS_KEY } from "../lib/status";
import { useT } from "./locale-context";

/**
 * The words on S1.4's one-step button, for the two screens that render it.
 *
 * A hook rather than a second label map: the key lives in `lib/status.ts` beside
 * `NEXT_STATUS`, where the pairing is visible, and this is only the part that
 * needs a reader. Returns `""` for a status with no next step — the callers
 * already guard on `NEXT_STATUS[status] !== null` before rendering a button, so
 * this is the unreachable branch rather than a second way to express it.
 */
export function useNextStatusLabel(): (status: Status) => string {
  const t = useT();

  return (status) => {
    const key = NEXT_STATUS_KEY[status];

    return key === null ? "" : t(key);
  };
}
