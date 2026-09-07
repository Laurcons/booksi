import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  unsaved = false,
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
   * There is work inside this dialog that closing it would throw away (§D49).
   *
   * Every dismissal the dialog does not own — Escape, a click on the
   * backdrop, its own ✕ — stops closing it and pulses the panel instead.
   * None of the three can say which of "discard" and "save" was meant, and
   * two of them are routinely pressed by accident, so all three hand the
   * question to the footer, where the buttons say what each answer does.
   *
   * The dialog stays closable: refusing the *ambiguous* exits only works
   * because an explicit one is on screen the whole time. A `Modal` that sets
   * this must show a way out of its own.
   */
  unsaved?: boolean;
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

  /**
   * Whether the panel is mid-pulse.
   *
   * A second dismissal attempt while it is running is deliberately ignored
   * rather than restarting the animation: re-triggering a CSS animation from
   * React means reaching into the node to force a reflow, and the pulse is
   * already saying the thing the second click would ask it to say.
   */
  const [nudging, setNudging] = useState(false);
  const nudge = () => setNudging(true);

  useEffect(() => {
    if (!nudging) {
      return;
    }

    // Longer than the animation: the ring is the half of the signal that has
    // to hold still to be seen, and it is all there is under reduced motion.
    const timer = setTimeout(() => setNudging(false), 600);

    return () => clearTimeout(timer);
  }, [nudging]);

  /**
   * Open and close, once each — and separate from the key handler below for a
   * reason worth keeping: this effect restores focus to the opener when it
   * tears down, so anything in its dependency list becomes a thing that yanks
   * the keyboard out of the dialog when it changes. `unsaved` changes on the
   * first keystroke.
   */
  useEffect(() => {
    // Whatever had focus before the dialog opened — the row's "Editează"
    // button, usually. Restored on close so the keyboard does not jump back to
    // the top of the document.
    const opener = document.activeElement as HTMLElement | null;
    // The page behind must not scroll while a dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (unsaved) {
          nudge();
        } else {
          onClose();
        }

        return;
      }

      if (event.key === "Tab") {
        trapTab(event, panelRef.current);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, unsaved]);

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
        if (event.target !== event.currentTarget) {
          return;
        }

        if (unsaved) {
          nudge();
        } else {
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
          "relative flex w-full flex-col border border-line bg-surface-2 shadow-lg shadow-black/50 transition-shadow " +
          // The refusal, drawn twice on purpose (§D49): a pulse for the eye
          // that just clicked outside, and a ring that stays put for the
          // 600ms the pulse lasts — the animation is what reduced motion
          // takes away, and the ring is what it leaves. Deliberately faint:
          // the movement is what carries this, and a dialog that flashes a
          // hard accent outline reads as an error when nothing is wrong.
          //
          // The two durations are the asymmetry the eye expects: the ring
          // arrives with the click (`duration-0`) and leaves on its own time
          // (`duration-500`), where switching the class off with no
          // transition made it disappear as if the browser had dropped a
          // frame. Both halves are one `box-shadow`, which is why this
          // interpolates at all.
          (nudging ? "animate-nudge ring-1 ring-accent/40 duration-0 " : "duration-500 ") +
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
            // One intent, one answer: every way of leaving that is not the
            // dialog's own footer gets the same pulse. A ✕ that closed while
            // the backdrop refused would be the loophole the pulse had just
            // finished warning about — and it is the closest thing to hand.
            onClick={() => (unsaved ? nudge() : onClose())}
            // The tooltip is the one part of this that arrives *before* the
            // click rather than after it, which is the house channel for an
            // explanation: on hover, taking up no room the rest of the time.
            title={unsaved ? t("common.unsaved") : undefined}
            aria-label={t("common.close")}
            className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-lg border border-line text-ink-3 transition-colors duration-150 hover:border-accent-quiet hover:text-ink"
          >
            <span aria-hidden>✕</span>
          </button>
        )}

        {/* The pulse, for everyone who cannot see it. */}
        <p role="status" className="sr-only">
          {nudging ? t("common.unsaved") : ""}
        </p>

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
