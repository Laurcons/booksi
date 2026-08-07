import { Router } from "express";
import type { Request } from "express";
import { html, raw, render, type Html } from "../lib/html";
import { chooseUi, UI_COOKIE } from "../lib/ui-choice";
import { PROBE_SCRIPT } from "./probe-script";

/**
 * The first route this workspace ever served, and the one everything else
 * waits on.
 *
 * Nobody publishes what engine a Kobo Libra Colour ships, and the community
 * User-Agent tables stop at devices from 2012. Rather than guess a baseline and
 * find out page by page which half of it was wrong, this page reports what the
 * device can actually do, and the rest of the Kobo frontend is written against
 * the answer.
 *
 * Two rules shape the whole file:
 *
 * 1. **The server-rendered half must survive total JavaScript failure.** If the
 *    engine cannot parse the script block, the headers, the routing decision
 *    and the visual samples are all still on screen — which is exactly the
 *    situation where the report matters most.
 * 2. **The script half is ES3.** No `const`, no arrow functions, no template
 *    literals, nothing that could fail to *parse*. A feature detector written
 *    in the features it is detecting reports nothing at all.
 */
export const probeRouter: Router = Router();

/** Set on the response so the next load can report whether it came back. */
const PROBE_COOKIE = "probe";

/**
 * Header values worth seeing, and a deliberately short list. `cookie` is not on
 * it: the session JWT rides in that header, and a diagnostic page that prints
 * it is a diagnostic page that leaks it onto an e-reader screen and into any
 * screenshot of one. Cookie *names* appear further down instead.
 */
const INTERESTING_HEADERS = [
  "user-agent",
  "accept",
  "accept-encoding",
  "accept-language",
  "host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "referer",
] as const;

function headerValue(req: Request, name: string): string {
  const value = req.headers[name];

  if (value === undefined) {
    return "— absent —";
  }

  return Array.isArray(value) ? value.join(", ") : value;
}

function factRow(label: string, value: string): Html {
  return html`<tr>
    <th>${label}</th>
    <td>${value}</td>
  </tr>`;
}

/**
 * Ten steps of grey and a row of saturated colours, at a size big enough that
 * the panel's own dithering is visible. Kaleido 3 puts the colour filter array
 * in front of the greyscale panel, so both of these answer questions no
 * feature detector can: how many greys survive as distinguishable, and how far
 * the colours actually get from grey.
 */
function greyRamp(): Html {
  const steps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return html`<div class="swatches">
    ${steps.map(
      (percent) => html`<div
        class="swatch"
        style="background: rgb(${Math.round((percent * 255) / 100)}, ${Math.round(
          (percent * 255) / 100,
        )}, ${Math.round((percent * 255) / 100)})"
      >
        <span>${percent}</span>
      </div>`,
    )}
  </div>`;
}

function colourSwatches(): Html {
  const colours: Array<[string, string]> = [
    ["red", "#c62828"],
    ["orange", "#ef6c00"],
    ["yellow", "#f9a825"],
    ["green", "#2e7d32"],
    ["teal", "#00695c"],
    ["blue", "#1565c0"],
    ["violet", "#6a1b9a"],
  ];

  return html`<div class="swatches">
    ${colours.map(
      ([name, hex]) => html`<div class="swatch" style="background: ${hex}">
        <span style="color: #fff">${name}</span>
      </div>`,
    )}
  </div>`;
}

/**
 * The chart question, asked directly. If this renders, server-rendered SVG is a
 * viable replacement for Recharts on the budget page; if it does not, the
 * fallback is a table of proportional block elements.
 */
function sampleSvg(): Html {
  const bars = [40, 75, 55, 90, 30, 65];

  return html`<svg
    width="300"
    height="120"
    viewBox="0 0 300 120"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="0" y="0" width="300" height="120" fill="#fff" stroke="#000" />
    ${bars.map(
      (value, index) => html`<rect
        x="${10 + index * 48}"
        y="${110 - value}"
        width="36"
        height="${value}"
        fill="#000"
      />`,
    )}
  </svg>`;
}

function textSizes(): Html {
  const sizes = [12, 14, 16, 18, 20, 24, 28];

  return html`${sizes.map(
    (size) =>
      html`<p style="font-size: ${size}px; margin: 0.25em 0">
        ${size}px — Cărți citite în vară: mărimea la care textul rămâne comod.
      </p>`,
  )}`;
}

probeRouter.get("/probe", (req, res) => {
  const choice = chooseUi({
    userAgent: req.headers["user-agent"],
    cookie: req.cookies?.[UI_COOKIE] as string | undefined,
  });

  // `?noviewport=1` drops the meta tag. Whether the browser honours it decides
  // every dimension in the stylesheet: the panel is 1264x1680 at 300ppi, so a
  // device reporting raw device pixels at ratio 1 would render a 16px font at
  // roughly the size of a grain of rice. Loading the page both ways and
  // comparing the reported widths is the only way to know which world we're in.
  const withoutViewport = req.query["noviewport"] === "1";

  const cookieNames = Object.keys(
    (req.cookies ?? {}) as Record<string, unknown>,
  );
  const probeCookieSeen = cookieNames.includes(PROBE_COOKIE);

  res.cookie(PROBE_COOKIE, "1", { httpOnly: false, sameSite: "lax", path: "/" });

  const page = html`<!doctype html>
    <html lang="ro">
      <head>
        <meta charset="utf-8" />
        ${withoutViewport
          ? raw("<!-- viewport meta deliberately omitted (?noviewport=1) -->")
          : raw('<meta name="viewport" content="width=device-width, initial-scale=1" />')}
        <title>Bookcsi — probe</title>
        <style>
          /* Everything here is deliberately ancient CSS. A stylesheet that
             needs custom properties to lay itself out cannot report that the
             device lacks custom properties. */
          body {
            font-family: Georgia, "Times New Roman", serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 16px;
            line-height: 1.4;
          }
          h1 { font-size: 24px; margin: 0 0 4px 0; }
          h2 { font-size: 19px; margin: 24px 0 8px 0; border-bottom: 2px solid #000; }
          p.lede { margin: 0 0 16px 0; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
          th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 15px; }
          th { width: 40%; font-weight: bold; }
          td { font-family: "Courier New", monospace; word-wrap: break-word; }
          .swatches { width: 100%; margin-bottom: 8px; }
          .swatch { display: inline-block; width: 60px; height: 44px; border: 1px solid #000; text-align: center; }
          .swatch span { font-size: 11px; font-family: "Courier New", monospace; }
          .layout-probe > div { border: 1px solid #000; padding: 8px; text-align: center; }
          .flex-probe { display: -webkit-box; display: flex; }
          .flex-probe > div { -webkit-box-flex: 1; flex: 1; }
          .grid-probe { display: grid; grid-template-columns: 1fr 1fr 1fr; }
          .rounded { border-radius: 12px; box-shadow: 3px 3px 0 #000; border: 1px solid #000; padding: 8px; }
          a { color: #000; }
          .nav a { display: inline-block; border: 1px solid #000; padding: 10px 14px; margin: 0 8px 8px 0; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>Bookcsi — probe</h1>
        <p class="lede">
          Pagina asta nu are nevoie de JavaScript ca să fie utilă. Tot ce e mai
          jos de „Ce spune JavaScript” lipsește dacă motorul nu poate rula
          scriptul — iar lipsa lor e ea însăși un rezultat.
        </p>

        <h2>1. Ce spune serverul</h2>
        <table>
          ${INTERESTING_HEADERS.map((name) =>
            factRow(name, headerValue(req, name)),
          )}
          ${factRow("cookie-uri primite", cookieNames.length > 0 ? cookieNames.join(", ") : "— niciunul —")}
          ${factRow(
            "cookie-ul de probă s-a întors",
            probeCookieSeen
              ? "da — cookie-urile funcționează"
              : "nu (normal la prima încărcare — reîncarcă pagina)",
          )}
          ${factRow("interfața aleasă", `${choice.ui} (motiv: ${choice.reason})`)}
          ${factRow("viewport meta", withoutViewport ? "omis" : "prezent")}
        </table>
        <p>
          <a href="/probe${withoutViewport ? "" : "?noviewport=1"}"
            >Încarcă ${withoutViewport ? "cu" : "fără"} viewport meta</a
          >
        </p>

        <h2>2. Ce se vede cu ochiul</h2>
        <p>Scară de gri — câte trepte se disting?</p>
        ${greyRamp()}
        <p>Culori — cât de departe ajung de gri pe Kaleido?</p>
        ${colourSwatches()}
        <p>Mărimi de text:</p>
        ${textSizes()}
        <p>SVG inline (dacă lipsește, graficele se fac din tabele):</p>
        ${sampleSvg()}
        <p>Colțuri rotunjite și umbră:</p>
        <div class="rounded">border-radius + box-shadow</div>
        <p>Flexbox — trei coloane egale sau una sub alta?</p>
        <div class="layout-probe flex-probe">
          <div>flex 1</div>
          <div>flex 2</div>
          <div>flex 3</div>
        </div>
        <p>Grid — trei coloane egale sau una sub alta?</p>
        <div class="layout-probe grid-probe">
          <div>grid 1</div>
          <div>grid 2</div>
          <div>grid 3</div>
        </div>

        <h2>3. Ce spune JavaScript</h2>
        <p id="js-status">
          Scriptul nu a rulat. Dacă textul ăsta rămâne aici, motorul nu a putut
          nici măcar să parseze un script ES3 — ceea ce e cel mai important
          rezultat de pe pagină.
        </p>
        <div id="js-results"></div>

        <h2>4. Comutator de interfață</h2>
        <p class="nav">
          <a href="/ui/lite">Fixează pe „lite”</a>
          <a href="/ui/full">Fixează pe „full”</a>
          <a href="/ui/auto">Înapoi la detecția automată</a>
        </p>

        <script>
          ${raw(PROBE_SCRIPT)}
        </script>
      </body>
    </html>`;

  res.type("html").send(render(page));
});
