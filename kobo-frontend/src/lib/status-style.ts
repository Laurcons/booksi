import { statusLabel, type Status } from "@bookcsi/shared";
import { KOBO_LOCALE } from "./locale";
import { html, type Html } from "./html";
import { accentWidth, bodyFont, fontSize, ink, ruleWidth } from "./tokens";
import { webPx } from "./units";

/**
 * §Status (docs/kobo_design.md) — the pill's border carries the redundant
 * channel, never colour: `Citesc` is thick, `Terminat` is doubled, `Wishlist`
 * and `Abandonat` are dotted, `Cumpărat` is a plain thin line. `Abandonat` is
 * also the one pill whose text uses `inkSecondary` — the single pill allowed
 * to look quieter than the rest.
 */
export interface StatusStyle {
  border: string;
  color: string;
}

const doubleWidth = accentWidth + ruleWidth;

const STATUS_STYLE: Record<Status, StatusStyle> = {
  WISHLIST: { border: `${ruleWidth}px dotted ${ink.primary}`, color: ink.primary },
  PURCHASED: { border: `${ruleWidth}px solid ${ink.primary}`, color: ink.primary },
  READING: { border: `${accentWidth}px solid ${ink.primary}`, color: ink.primary },
  FINISHED: { border: `${doubleWidth}px double ${ink.primary}`, color: ink.primary },
  ABANDONED: { border: `${ruleWidth}px dotted ${ink.primary}`, color: ink.secondary },
};

export function statusStyle(status: Status): StatusStyle {
  return STATUS_STYLE[status];
}

/**
 * A pill with an inline style rather than a shared class: it is the one piece
 * of a page that needs a different border per instance, and a class per
 * status would just move the same lookup into CSS for no benefit.
 *
 * Set at `fontSize.meta` rather than inheriting the ambient body size — it
 * sits beside the meta line (author · year) as the same kind of secondary
 * information, and the no-scroll harness's row-budget measurement (see
 * `books-list.ts`'s own comment) is what surfaced that the body-sized pill
 * had been costing more of a fișă's height than its status actually needed.
 */
export function statusPill(status: Status): Html {
  const style = statusStyle(status);

  return html`<span
    style="display: inline-block; border: ${style.border}; padding: ${webPx(2)}px ${webPx(8)}px; font-family: ${bodyFont}; font-size: ${fontSize.meta}px; color: ${style.color};"
    >${statusLabel(status, KOBO_LOCALE)}</span
  >`;
}
