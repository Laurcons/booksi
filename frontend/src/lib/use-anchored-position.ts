import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Where a dropdown should be drawn, in viewport coordinates.
 *
 * `top` and `bottom` are exclusive: a list opening downward is pinned by its
 * top edge, one opening upward by its bottom edge, so a short list hugs the
 * field it belongs to instead of floating at the far end of the space it was
 * allowed.
 */
export interface AnchoredPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/** Between the field and its list. */
const GAP = 4;

/**
 * The page margin the list may not cross. This is the whole point of anchoring
 * to the viewport: the limits are the page's, not those of whatever dialog or
 * scroll container the field happens to sit in.
 */
const MARGIN = 8;

/**
 * Position a dropdown against a field, in viewport coordinates, so it can be
 * portalled out of everything that would clip it.
 *
 * The problem it solves: a `position: absolute` list is clipped by any ancestor
 * with `overflow` other than `visible`, and the book form's tab panel is
 * `overflow-y-auto` with a fixed height — so the category list, which sits on
 * the last row of the tab, was cut off a few pixels below the field. Flipping
 * it upward or clamping it to the panel would have kept it inside a 432px box;
 * the maintainer's call, and the right one, is that a transient overlay should
 * be bounded by the page.
 *
 * **Why the caller must portal it.** `position: fixed` is resolved against the
 * nearest ancestor that has a transform, filter or perspective rather than
 * against the viewport, and `Modal`'s panel takes a `transform: scale()` every
 * time it refuses a dismissal (§D49's nudge). A list rendered inside the panel
 * would jump out of place mid-animation. `AnchoredPanel` renders through a
 * portal for that reason, which also puts the list outside the modal's focus
 * trap — so rows must not be tabbable; see `CategoryPicker` for the arrow-key
 * navigation that replaces it.
 *
 * `onDismiss` fires when the field scrolls out of the container that clips it.
 * A list left hovering over a field the reader can no longer see is worse than
 * no list at all, and it cannot simply be clamped: it is no longer above
 * anything.
 */
export function useAnchoredPosition(
  open: boolean,
  /** How tall the list would like to be, when there is room for it. */
  preferredHeight: number,
  onDismiss: () => void,
) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  // Held in a ref so a caller passing a fresh closure on every render does not
  // resubscribe the listeners below on every keystroke.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  const measure = useCallback(() => {
    const anchor = anchorRef.current;

    if (anchor === null) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const clip = clipper(anchor);

    if (clip !== null) {
      const bounds = clip.getBoundingClientRect();

      if (rect.bottom < bounds.top || rect.top > bounds.bottom) {
        dismiss.current();
        return;
      }
    }

    const below = window.innerHeight - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;

    // Upward only when downward is genuinely too small *and* upward is roomier.
    // Preferring "below" otherwise keeps the list where the eye already is.
    const upward = below < preferredHeight && above > below;
    const room = Math.max(0, upward ? above : below);

    const next: AnchoredPosition = {
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(preferredHeight, room),
      ...(upward
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    };

    // Compared rather than set unconditionally: this runs from a
    // `ResizeObserver` on the anchor, and a state write on every observation
    // would be a render loop.
    setPosition((current) => (same(current, next) ? current : next));
  }, [preferredHeight]);

  // Layout effect, so the list is measured before the browser paints it and
  // never appears at the wrong place for one frame.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const anchor = anchorRef.current;

    // `capture` because scroll does not bubble: the panel that moves the field
    // is a `div`, not the window.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    // The field's own height changes without anything scrolling — a chip added
    // to the category box wraps the line and pushes the list down.
    const observer = new ResizeObserver(measure);

    if (anchor !== null) {
      observer.observe(anchor);
    }

    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [open, measure]);

  return { anchorRef, position };
}

/**
 * The nearest ancestor that would clip an absolutely-positioned child — which
 * is any `overflow` other than `visible`, on either axis.
 */
function clipper(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;

  while (node !== null && node !== document.body) {
    const style = getComputedStyle(node);

    if (style.overflowY !== "visible" || style.overflowX !== "visible") {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

function same(a: AnchoredPosition | null, b: AnchoredPosition): boolean {
  return (
    a !== null &&
    a.left === b.left &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight &&
    a.top === b.top &&
    a.bottom === b.bottom
  );
}
