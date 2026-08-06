import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * The only place in the app that gets a shadow: docs/DESIGN.md puts elevation
 * in the surface scale and allows shadows on real overlays alone.
 *
 * Closing on Escape and on a click outside is not decoration — the dialog is
 * how a book gets edited and deleted, and being trapped in it with no visible
 * way out is the classic modal failure.
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // The page behind must not scroll while a dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    // Focus the first control, so the keyboard lands inside the dialog.
    panelRef.current
      ?.querySelector<HTMLElement>("input, select, textarea, button")
      ?.focus();
  }, []);

  return (
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
    </div>
  );
}
