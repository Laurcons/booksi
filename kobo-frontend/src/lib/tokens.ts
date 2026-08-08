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
