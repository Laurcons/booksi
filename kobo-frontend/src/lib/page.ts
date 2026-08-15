import { html, raw, render, type Html } from "./html";
import { NAV_ITEMS } from "./nav";
import {
  accent,
  accentWidth,
  bodyFont,
  buttonRadius,
  buttonShadow,
  displayFont,
  fillQuiet,
  fontSize,
  ink,
  lineHeight,
  pageMargin,
  rule,
  ruleWidth,
  surface,
  touchGap,
  touchMin,
} from "./tokens";
import { webPx } from "./units";

/**
 * The chassis every app page on this surface builds on, from here on.
 * `/probe` deliberately does not use this — its whole job is to stand on
 * ancient CSS with nothing shared, so that a failure there is never this
 * file's fault. Everything downstream of pairing does share it, which is the
 * point: one `<style>` block, computed from `tokens.ts`, instead of each page
 * re-deriving the same rules and drifting.
 *
 * §Buget de pagină caps HTML + CSS at 50KB inline; §Mișcare bans every
 * transition; §Geometrie's golden rule means nothing here may depend on
 * `-webkit-box` to be correct, only to look better where it exists.
 */

function baseStyle(): string {
  return `
    html, body { margin: 0; padding: 0; background: ${surface}; color: ${ink.primary}; }
    body {
      font-family: ${bodyFont};
      font-size: ${fontSize.body}px;
      line-height: ${lineHeight};
      padding: ${pageMargin}px;
    }
    h1, h2 {
      font-family: ${displayFont};
      font-weight: normal;
      margin: 0 0 ${webPx(12)}px 0;
    }
    h1 { font-size: ${fontSize.pageTitle}px; }
    h2 { font-size: ${fontSize.sectionTitle}px; }
    p { margin: 0 0 ${webPx(16)}px 0; }
    a { color: ${ink.primary}; }
    hr {
      border: none;
      border-top: ${ruleWidth}px solid ${rule};
      margin: ${webPx(24)}px 0;
      background: ${fillQuiet};
    }
    /* §Componente — o țintă de atingere, nu un buton plin: contur, nu umplutură.
       font-size at meta, not body: the touch-target floor is min-height /
       min-width (9mm, §Geometrie) below, not the font — the button was
       reading as bigger than the target it has to be, since padding plus a
       body-sized line was already well past 9mm on its own. */
    .btn {
      display: inline-block;
      box-sizing: border-box;
      min-height: ${touchMin}px;
      min-width: ${touchMin}px;
      padding: ${webPx(8)}px ${webPx(16)}px;
      margin: ${webPx(8)}px ${touchGap}px ${webPx(8)}px 0;
      border: ${ruleWidth}px solid ${ink.primary};
      background: ${surface};
      color: ${ink.primary};
      font-family: ${bodyFont};
      font-size: ${fontSize.meta}px;
      text-align: center;
      text-decoration: none;
      /* Buttons and links share this class; without it a real <button>
         keeps its platform chrome instead of looking like its <a> siblings. */
      appearance: none;
    }
    .btn[aria-disabled] { color: ${ink.muted}; border-style: dotted; }
    /* The one deliberate departure from "contur, nu umplutură" — reserved for
       the single most important action on a page. §Culoare explains why this
       is the one place the accent fills rather than borders, and why the
       corners round and the shadow has no blur (§P3 does not have blur to
       give it). Extra right margin clears the shadow itself, so it never
       overlaps whatever sits next to the button. */
    .btn-primary {
      background: ${accent};
      border-radius: ${buttonRadius}px;
      box-shadow: ${buttonShadow}px ${buttonShadow}px 0 ${ink.primary};
      margin-right: ${touchGap + buttonShadow}px;
    }
    /* §Componente/Navigație — bordered text links, banded; the current
       destination gets the thicker accent-coloured border, never a fill.
       min-height plus box-sizing: border-box added deliberately, matching
       .btn: without it, a nav pill's touch-target height came only from its
       (now smaller) padding and font, with nothing guaranteeing it stayed at
       or above §Geometrie's 9mm floor the way .btn always did. */
    .nav { margin: 0 0 ${webPx(16)}px 0; }
    .nav a, .nav span {
      display: inline-block;
      box-sizing: border-box;
      min-height: ${touchMin}px;
      border: ${ruleWidth}px solid ${ink.primary};
      padding: ${webPx(6)}px ${webPx(12)}px;
      margin: 0 ${webPx(8)}px ${webPx(8)}px 0;
      font-size: ${fontSize.meta}px;
      text-decoration: none;
      color: ${ink.primary};
    }
    .nav a[aria-current="page"] { border-width: ${accentWidth}px; border-color: ${accent}; }
    .nav span { color: ${ink.muted}; border-style: dotted; }
  `;
}

function navBand(active: string): Html {
  return html`<nav class="nav">
    ${NAV_ITEMS.map((item) => {
      if (item.href === null) {
        return html`<span>${item.label}</span>`;
      }

      return item.label === active
        ? html`<a href="${item.href}" aria-current="page">${item.label}</a>`
        : html`<a href="${item.href}">${item.label}</a>`;
    })}
  </nav>`;
}

export interface PageOptions {
  title: string;
  body: Html;
  /** Extra rules appended after the base style — a page's own layout, never a replacement for it. */
  extraStyle?: string;
  /**
   * Which `NAV_ITEMS` entry this page is. Omitted entirely by the pairing
   * pages — there is no session yet for the nav band to hang off of.
   */
  activeNav?: string;
}

export function renderPage(options: PageOptions): string {
  const page = html`<!doctype html>
    <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${options.title}</title>
        <style>
          ${raw(baseStyle() + (options.extraStyle ?? ""))}
        </style>
      </head>
      <body>
        ${options.activeNav ? navBand(options.activeNav) : null}
        ${options.body}
      </body>
    </html>`;

  return render(page);
}
