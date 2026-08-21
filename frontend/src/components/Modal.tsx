import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { focusable, trapTab } from "../lib/focus-trap";
import { useT } from "../i18n/locale-context";

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
 *
 * The trap itself lives in `lib/focus-trap` now that the mobile nav drawer
 * needs the same one.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
  header,
  sheet = false,
  dismissible = false,
  autoFocus = true,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /**
   * A header of the dialog's own making, in place of the title block.
   *
   * `title` is still required and still names the dialog — it moves from
   * `aria-labelledby` to `aria-label`, so a custom header is free to be a
   * layout (a cover, a status pill, a truncated title) rather than a heading
   * this component can point at.
   */
  header?: ReactNode;
  /**
   * Below `sm`, sit on the bottom edge and fill the screen instead of floating
   * in the middle of it. The dialog that edits a book is tall enough that a
   * centred card on a phone is a card with its own scrollbar inside the page's
   * scrollbar; a sheet has one, and its footer stays where the thumb is.
   */
  sheet?: boolean;
  /**
   * Draw the close button. Escape and the backdrop already close every dialog,
   * but neither is visible — and on a phone there is no Escape key and no
   * backdrop worth aiming at once the panel fills the screen.
   */
  dismissible?: boolean;
  /**
   * Whether to put the keyboard on the first control. Turned off by dialogs
   * that want a different landing place: with tabs, the first focusable thing
   * is a tab button, and the field the user came to change is further down.
   */
  autoFocus?: boolean;
}) {
  const t = useT();
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
    if (!autoFocus) {
      return;
    }

    // Focus the first control, so the keyboard lands inside the dialog.
    focusable(panelRef.current)[0]?.focus();
  }, [autoFocus]);

  return createPortal(
    <div
      className={
        "fixed inset-0 z-40 grid overflow-y-auto bg-black/60 sm:place-items-center " +
        (sheet
          ? "place-items-end p-0 sm:p-4"
          : "place-items-start p-4")
      }
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
        aria-label={header ? title : undefined}
        aria-labelledby={header ? undefined : titleId}
        className={
          "relative flex w-full flex-col border border-line bg-surface-2 shadow-lg shadow-black/50 " +
          // 45rem is the book form's measured width (docs/DESIGN.md §Dialogul de editare).
          (wide ? "max-w-[45rem] " : "max-w-md ") +
          // A sheet is as tall as the phone, minus a strip of the page behind
          // it: enough to see that the library is still there, and to have
          // somewhere to tap that is not the dialog.
          (sheet
            ? "h-[94dvh] rounded-t-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl"
            : "rounded-xl")
        }
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors duration-150 hover:border-accent-quiet hover:text-ink"
          >
            <span aria-hidden>✕</span>
          </button>
        )}

        {header ?? (
          <div className="border-b border-line px-6 py-4">
            <h2 id={titleId} className="font-display text-xl text-ink">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-ink-3">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
