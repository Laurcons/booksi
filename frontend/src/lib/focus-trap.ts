/**
 * Keeping the keyboard inside an overlay.
 *
 * Lifted out of `Modal` when the mobile nav drawer became the second thing that
 * needs it. The two overlays look nothing alike — one is a centred dialog, the
 * other a slide-over — but the failure they have to avoid is identical: Tab
 * walking out of an `aria-modal` element into the page behind it, where a
 * screen reader reads content the overlay claims to have covered.
 */

/**
 * Everything inside the panel the keyboard can reach, in tab order.
 *
 * `disabled` is excluded because the browser skips those anyway — a submit
 * button reading "Se salvează…" must not be able to become the wrap-around
 * point. Radio groups are left alone: all five stars are focusable here, which
 * is one more Tab stop than a browser gives them, and the alternative is
 * teaching this function about `name` attributes for no real gain.
 */
export function focusable(panel: HTMLElement | null): HTMLElement[] {
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
 * Keeps Tab inside the panel by wrapping it around the ends.
 *
 * Only the two edges need handling: everywhere in between, the browser's own
 * tab order is already correct and interfering with it would be how an overlay
 * ends up with a tab order nobody can predict.
 */
export function trapTab(event: KeyboardEvent, panel: HTMLElement | null): void {
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
