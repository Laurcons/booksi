import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The only place in the app that gets a shadow: docs/DESIGN.md puts elevation
 * in the surface scale and allows shadows on real overlays alone.
 *
 * Closing on Escape and on a click outside is not decoration — the dialog is
 * how a book gets edited and deleted, and being trapped in it with no visible
 * way out is the classic modal failure. The opposite failure is the one this
 * file had: nothing held focus in, so Tab walked out of an `aria-modal` dialog
 * and into the page behind it, where a screen reader reads content the dialog
 * claims to have covered and a keyboard user cannot see what they have landed
 * on. Both are fixed here rather than by reaching for a library.
 *
 * Rendered through a portal so the markup sits at the end of `<body>` rather
 * than wherever it was mounted. `StartReadingDialog` opens from inside a table
 * cell, and a `position: fixed` overlay nested in a `<td>` works only until
 * some ancestor grows a `transform` or a `filter` — either of which silently
 * turns it into the containing block and shrinks the "full screen" overlay to
 * the size of a table row.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Whatever had focus before the dialog opened — the row's "Editează"
    // button, usually. Restored on close so the keyboard does not jump back to
    // the top of the document.
    const opener = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        trapTab(event, panelRef.current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // The page behind must not scroll while a dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    // Focus the first control, so the keyboard lands inside the dialog.
    focusable(panelRef.current)[0]?.focus();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-40 grid place-items-start overflow-y-auto bg-black/60 p-4 sm:place-items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          "w-full rounded-xl border border-line bg-surface-2 shadow-lg shadow-black/50 " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <div className="border-b border-line px-6 py-4">
          <h2 id={titleId} className="font-display text-xl text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-ink-3">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Everything inside the panel the keyboard can reach, in tab order.
 *
 * `disabled` is excluded because the browser skips those anyway — a submit
 * button reading "Se salvează…" must not be able to become the wrap-around
 * point. Radio groups are left alone: all five stars are focusable here, which
 * is one more Tab stop than a browser gives them, and the alternative is
 * teaching this function about `name` attributes for no real gain.
 */
function focusable(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) {
    return [];
  }

  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Keeps Tab inside the dialog by wrapping it around the ends.
 *
 * Only the two edges need handling: everywhere in between, the browser's own
 * tab order is already correct and interfering with it would be how a dialog
 * ends up with a tab order nobody can predict.
 */
function trapTab(event: KeyboardEvent, panel: HTMLElement | null): void {
  const stops = focusable(panel);

  if (stops.length === 0) {
    return;
  }

  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;

  // Focus escaping the panel entirely — through a click on the backdrop, say —
  // would otherwise leave Tab handing control to the page behind.
  if (!panel?.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
