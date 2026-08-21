import type { MessageKey, TFunction } from "../../../i18n/catalog";

/**
 * The class strings the book form is built from, and the two helpers that pick
 * between them.
 *
 * Kept out of `fields.tsx` for the same reason `StarRating` keeps its constants
 * private: a module that exports both components and plain values loses fast
 * refresh, and this is the module every field in four tabs imports.
 */
const INPUT_BASE =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-ink-3";

/** The live input. */
export const INPUT = `${INPUT_BASE} border-line bg-surface-1 text-ink focus:border-accent`;

/**
 * The locked one: a well sunk into the panel rather than a paler copy of the
 * live input. On a dark warm surface, "greyed out" reads as nothing at all —
 * recessed reads as a field that is there and closed.
 */
export const INPUT_LOCKED = `${INPUT_BASE} border-line/60 bg-surface-0/85 text-ink-3 shadow-[inset_0_1px_3px_rgba(0,0,0,.5)]`;

/** The invalid one. `border-error` is the app's only red (docs/DESIGN.md). */
export const INPUT_BAD = `${INPUT_BASE} border-error bg-surface-1 text-ink`;

export function inputClass({
  locked = false,
  invalid = false,
}: {
  locked?: boolean;
  invalid?: boolean;
}): string {
  if (invalid) {
    return INPUT_BAD;
  }

  return locked ? INPUT_LOCKED : INPUT;
}

export const TEXTAREA = `${INPUT} resize-none leading-relaxed`;

export const BUTTON_QUIET =
  "rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink";

export const BUTTON_PRIMARY =
  "rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60";

export const BUTTON_GHOST =
  "shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-ink-2 transition-colors duration-150 hover:border-accent-quiet hover:text-ink";

/**
 * The tooltip a locked control carries, as props rather than as an element.
 *
 * `title` is the whole mechanism, and that is the point: the explanation exists
 * for the one person who wonders, appears where the cursor already is, and
 * takes up no room in the layout the other ninety-nine times.
 */
export function lockProps(
  reason: MessageKey | null,
  t: TFunction,
): { title?: string } {
  return reason === null ? {} : { title: t(reason) };
}
