import { html, raw, render, type Html } from "./html";
import {
  bodyFont,
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
    /* §Componente — o țintă de atingere, nu un buton plin: contur, nu umplutură. */
    .btn {
      display: inline-block;
      box-sizing: border-box;
      min-height: ${touchMin}px;
      min-width: ${touchMin}px;
      padding: ${webPx(12)}px ${webPx(20)}px;
      margin: ${webPx(8)}px ${touchGap}px ${webPx(8)}px 0;
      border: ${ruleWidth}px solid ${ink.primary};
      background: ${surface};
      color: ${ink.primary};
      font-family: ${bodyFont};
      font-size: ${fontSize.body}px;
      text-align: center;
      text-decoration: none;
    }
  `;
}

export interface PageOptions {
  title: string;
  body: Html;
  /** Extra rules appended after the base style — a page's own layout, never a replacement for it. */
  extraStyle?: string;
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
        ${options.body}
      </body>
    </html>`;

  return render(page);
}
