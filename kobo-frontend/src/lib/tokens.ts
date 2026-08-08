import { mm, pt, webPx } from "./units";

/**
 * §Culoare / §Cerneală și suprafețe (docs/kobo_design.md). No custom
 * properties on this engine (§P4), so these are TypeScript, interpolated into
 * each page's inline `<style>` — one place to change, checked by `tsc`.
 */
export const ink = {
  primary: "#000000",
  secondary: "#4A4A4A",
  muted: "#6E6E6E",
} as const;

export const rule = "#000000";
export const fillQuiet = "#DCDCDC";
export const surface = "#FFFFFF";

/**
 * `DESIGN.md`'s own accent, borrowed rather than reinvented — and the same
 * one of its two golds: that document keeps `#E3B04B` for interface chrome
 * (buttons, active states, focus) and reserves the darker `#C98500` for data
 * in charts specifically so the two never get confused. A button is chrome,
 * so it gets this one. Used on primary actions and the current-nav marker
 * only — everything else stays the ink/surface pair §Culoare already
 * settled, on the same reasoning that kept it there: this is still paper,
 * not a screen, and one accent spent everywhere stops being an accent.
 */
export const accent = "#E3B04B";

/** §Tipografie — generic families only; nothing here is ever downloaded. */
export const displayFont = 'Georgia, "Times New Roman", serif';
export const bodyFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** §Scara, resolved through §Unități. */
export const fontSize = {
  hero: pt(28),
  pageTitle: pt(20),
  sectionTitle: pt(14),
  body: pt(12),
  meta: pt(10),
  floor: pt(9),
} as const;

export const lineHeight = 1.45;

/** §Unități's correction table — every rule and accent on the page, once. */
export const ruleWidth = webPx(1);
export const accentWidth = webPx(2);

/** §Geometrie, spațiere, ținte. */
export const touchMin = mm(9);
export const touchGap = mm(3);
export const pageMargin = mm(5);

/** §Coperți — 15×22mm, the one exception to "rază 0 peste tot". */
export const coverWidth = mm(15);
export const coverHeight = mm(22);
export const coverRadius = webPx(2);

/**
 * The primary-button treatment: rounded, filled with `accent`, and a flat
 * offset shadow — deliberately flat, since §P3 measured `box-shadow` landing
 * on the device with no blur radius at all (a solid rectangle, not a soft
 * one). Rather than fight that, the shape leans into it: a stamped, printed
 * look instead of an imitation of a screen's soft shadow it cannot produce.
 */
export const buttonRadius = webPx(8);
export const buttonShadow = webPx(3);
