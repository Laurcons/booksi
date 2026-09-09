import { createContext, useContext } from "react";

/**
 * §D51 — the toast context and the hook that reads it.
 *
 * Split from `ToastProvider.tsx` for the same reason `locale-context.ts` is
 * split from `LocaleProvider.tsx`: fast refresh only works on a module whose
 * exports are all components, so keeping the hook here means editing either one
 * is not a full reload.
 */

/**
 * How loud a toast is, and it decides more than the colour.
 *
 * - `info` — something worked. Announced politely, and it **dismisses itself**:
 *   the reader does not need to act, and a confirmation that has to be closed
 *   is worse than no confirmation at all.
 * - `error` — something did not. Announced assertively, and it **stays until
 *   dismissed**, because the whole reason §D51 needed toasts is a message the
 *   reader must actually read: "the author's details were saved, but the book
 *   was not". A sentence like that timing out after four seconds is a sentence
 *   that might as well not have been shown.
 */
export type ToastTone = "info" | "error";

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

export type ToastContextValue = {
  /** Queue a toast. Returns its id, so a caller may dismiss it early. */
  show: (tone: ToastTone, text: string) => number;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Throws outside the provider rather than degrading to a no-op.
 *
 * A silently swallowed toast is the failure this is guarding: the messages that
 * go through here are the only feedback some actions have — an author created,
 * an author deleted with books left behind, a half-saved form — so a component
 * that cannot show them must fail loudly at development time rather than run
 * mute in production.
 */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (value === null) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  return value;
}
