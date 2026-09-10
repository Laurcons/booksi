import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import type { AnchoredPosition } from "../lib/use-anchored-position";

/**
 * A dropdown drawn over everything, at coordinates `useAnchoredPosition`
 * measured for it.
 *
 * Rendered through a portal to `<body>`, which is what lets it cross the edge
 * of the dialog it belongs to — the hook's own note has the two reasons a
 * portal rather than `position: fixed` in place is required.
 *
 * The chrome lives here because both pickers had written the same six classes:
 * one border, one background, one shadow (docs/DESIGN.md allows the shadow on
 * real overlays alone), and the list's own scrolling. `z-[45]` is deliberately
 * between the two layers that already exist — above `Modal`'s `z-40`, because
 * that is the whole point, and below the toasts' `z-50`, because a message
 * about a failed save must not end up behind a list of shelves.
 */
export function AnchoredPanel({
  position,
  panelRef,
  className = "",
  children,
}: {
  /** `null` until the field has been measured, which is one layout tick. */
  position: AnchoredPosition | null;
  /** For a caller that has to reach the scroll container — see `CategoryPicker`. */
  panelRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}) {
  if (position === null) {
    return null;
  }

  const { left, width, maxHeight, top, bottom } = position;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", left, width, maxHeight, top, bottom }}
      className={
        "z-[45] overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface-1 shadow-lg " +
        className
      }
    >
      {children}
    </div>,
    document.body,
  );
}
