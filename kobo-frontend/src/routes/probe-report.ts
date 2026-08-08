import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { html, render } from "../lib/html";
import { captureHeaderFacts } from "../lib/facts";

/**
 * The other half of the problem `/probe` exists to solve: the report is easy
 * to *see* on the device and hard to *get off* it. There is no clipboard
 * bridge, no way to email a screenshot from the beta browser, and copying a
 * table of forty rows by hand is not a thing anyone should be asked to do.
 *
 * So the page submits itself. A tap on the Kobo lands a plain HTML form POST
 * here, which writes one JSON file to disk — on the same machine the
 * development server already runs on — and whoever is driving that machine
 * reads the file directly. No transcription step exists to get wrong.
 */
export const probeReportRouter: Router = Router();

/**
 * Resolved from this module, the same reasoning as `config/env.ts`'s
 * `loadDotEnv`: `dist/routes` and `src/routes` sit at the same depth under
 * the workspace root, so the path is correct whether this runs built or
 * under `vitest` directly against `src/`.
 */
export const REPORTS_DIR = path.join(__dirname, "..", "..", "reports");

function ensureReportsDir(): void {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function confirmationPage(): string {
  return render(html`<!doctype html>
    <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Raport trimis</title>
      </head>
      <body style="font-family: Georgia, serif; padding: 24px; color: #000">
        <h1>Raport trimis</h1>
        <p>Poți închide pagina asta.</p>
        <p><a href="/probe">Înapoi la probă</a></p>
      </body>
    </html>`);
}

probeReportRouter.post("/probe/report", (req, res) => {
  ensureReportsDir();

  const record = {
    receivedAt: new Date().toISOString(),
    headers: captureHeaderFacts(req),
    cookies: Object.keys((req.cookies ?? {}) as Record<string, unknown>),
    // Everything the form carried: the manual visual-judgment radios, and
    // every fact `probe-script.ts` could establish, appended as hidden
    // inputs at the moment each row was computed.
    fields: (req.body ?? {}) as Record<string, unknown>,
  };

  const filename = `${record.receivedAt.replace(/[:.]/g, "-")}.json`;
  fs.writeFileSync(
    path.join(REPORTS_DIR, filename),
    JSON.stringify(record, null, 2),
  );

  res.type("html").send(confirmationPage());
});

/**
 * Not the primary path — reports are meant to be read from disk directly —
 * but a quick way to confirm from the device itself that a submission
 * actually landed, without having to ask.
 */
probeReportRouter.get("/probe/reports", (_req, res) => {
  ensureReportsDir();

  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();

  const page = html`<!doctype html>
    <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Rapoarte primite</title>
      </head>
      <body style="font-family: Georgia, serif; padding: 24px; color: #000">
        <h1>Rapoarte primite (${String(files.length)})</h1>
        <ul>
          ${files.map((name) => html`<li>${name}</li>`)}
        </ul>
        <p><a href="/probe">Înapoi la probă</a></p>
      </body>
    </html>`;

  res.type("html").send(render(page));
});
