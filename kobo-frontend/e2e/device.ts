/**
 * The Kobo Libra Colour's panel and ancient WebKit, as `/probe` actually
 * measured it on 2026-08-07 — the raw record lives at
 * `kobo-frontend/reports/2026-08-07T23-32-11-652Z.json` (gitignored, a device
 * capture rather than project source) and is summarised in
 * `docs/kobo_design.md` §P. A Playwright context configured this way is the
 * closest a desktop Chromium gets to standing in for the device: same
 * viewport, same pixel ratio, same User-Agent string the reverse proxy and
 * `ui-choice.ts` route on.
 *
 * It is not the device. Chromium has `flex`, `grid`, `fetch`, `Promise`,
 * custom properties, blurred `box-shadow`, and no Kaleido colour filter —
 * every one of which the probe found missing or different. A page that only
 * passes here is not proven to work on the device; a page that fails here
 * (overflows 1264px of height, for instance) is proven broken on it too,
 * since nothing about the gaps above would ever make a page *shorter*.
 */
export const KOBO_VIEWPORT = { width: 1212, height: 1264 };

export const KOBO_DEVICE_SCALE_FACTOR = 1;

/**
 * The HTTP header value, not `js_navigator_useragent` from the same report —
 * the two differ on the real device, and the header is what `ui-choice.ts`
 * and the reverse proxy actually route on (`docker/kobo-routing.conf`).
 */
export const KOBO_USER_AGENT =
  "Mozilla/5.0 (Linux; U; Android 2.0; en-us;) AppleWebKit/538.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/538.1 (Kobo Touch 0390/4.45.23697)";

/**
 * A cosmetic approximation of the Kaleido panel only — grayscale plus a touch
 * of contrast loss, applied to a page right before a screenshot is taken, never
 * before the layout measurement that decides pass/fail. The design system is
 * already black-on-white by decision (§Culoare), so this mostly matters for
 * the one accent colour and for cover art, and even then it is a guess, not a
 * measurement: §P5 confirmed swatches read as "coloured, but muted" and left
 * it there.
 */
export const KALEIDO_APPROXIMATION_CSS =
  "html { filter: grayscale(0.9) contrast(0.92) brightness(1.02); }";
