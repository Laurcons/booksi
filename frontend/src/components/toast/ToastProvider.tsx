import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/locale-context";
import { ToastContext, type Toast, type ToastTone } from "./toast-context";

/**
 * §D51 — the app's first transient messages, and the reason it needed them.
 *
 * Every other failure in bookcsi has a place on screen already: a form's
 * validation hangs under its field, a dialog's request failure sits above its
 * footer, a page's load failure replaces the page. All of them share one
 * property — the message belongs to the thing the reader is looking at.
 *
 * The author entity broke that. Saving the book form now writes **two**
 * entities, so "the author's details were saved, but the book was not" is a
 * sentence about neither of them alone; and creating or deleting an author
 * happens *inside* a dialog whose own error slot is about the book. Those
 * messages have no owner on screen, which is exactly what a toast is for.
 *
 * ## Hand-rolled, like the modal and the focus trap
 *
 * A library was the obvious first answer and the wrong one. `react-hot-toast`
 * and friends bring their own DOM, their own stacking context and their own
 * light-mode-first styling, so using one here would mean overriding all three
 * to arrive back at the app's own tokens — and the app already made this call
 * once, in `Modal.tsx`: "both are fixed here rather than by reaching for a
 * library". The whole of it is one state array, a portal and a timer.
 *
 * ## Where it sits, and why that is not arbitrary
 *
 * `z-50`, one step above `Modal`'s `z-40`. Load-bearing rather than tidy: the
 * partial-save message fires while the book form is still open (§D51 keeps it
 * open, so the half that failed can be retried), and a toast rendered *under*
 * that dialog's backdrop would be a message the reader is told to read and
 * cannot see.
 *
 * Bottom-right above `sm`, top-centre below it. The phone case is the reason
 * for the split: there the book form is a bottom sheet with its footer glued to
 * the thumb (§D48), so anything in that corner would land on the Save button
 * it is reporting about.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Ids from a counter rather than `Date.now()`.
   *
   * Two toasts queued in the same tick — which is precisely what a partial save
   * does when both requests fail — would take the same timestamp, and React
   * would then see two children with the same key.
   */
  const nextId = useRef(1);

  /** Cleared on dismiss, so a toast closed by hand does not fire its timer
   *  into a component that has already forgotten it. */
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);

    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, text: string) => {
      const id = nextId.current++;

      setToasts((current) => {
        // Three at a time, oldest dropped. A stack that grows without bound
        // stops being a message and becomes a wall — and the newest toast is
        // the one that just happened, so it is the one that keeps its place.
        const kept = [...current, { id, tone, text }];
        return kept.slice(-MAX_VISIBLE);
      });

      if (tone === "info") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), INFO_DURATION_MS),
        );
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** Long enough to read a sentence, short enough not to sit in the way. */
const INFO_DURATION_MS = 5000;

const MAX_VISIBLE = 3;

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const t = useT();

  // Nothing in the DOM when there is nothing to say: an always-mounted fixed
  // container is an invisible box sitting over the corner of every screen,
  // which eventually swallows a click on something underneath it.
  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div
      // `pointer-events-none` on the stack and `auto` on each toast, so the
      // gaps between them are not a dead zone over the page.
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          /**
           * `alert` for a failure, `status` for a confirmation — the difference
           * is whether a screen reader interrupts what it is currently saying.
           * A half-saved form is worth interrupting for; "author created" is
           * not.
           */
          role={toast.tone === "error" ? "alert" : "status"}
          className={
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg motion-safe:animate-toast-in " +
            (toast.tone === "error"
              ? "border-error/40 bg-surface-2 text-ink"
              : "border-line bg-surface-2 text-ink")
          }
        >
          {/*
            A rule of colour rather than an icon, and the app's one red is used
            for exactly what §Eroare reserves it for. Not a coloured background:
            docs/DESIGN.md §Anti-tipare rejects surfaces that carry state
            colour, and a red panel would read as a system failure rather than
            as a sentence about one save.
          */}
          <span
            aria-hidden
            className={
              "mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full " +
              (toast.tone === "error" ? "bg-error" : "bg-accent")
            }
          />

          <p className="min-w-0 flex-1 text-sm leading-relaxed">{toast.text}</p>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t("toast.dismiss")}
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
