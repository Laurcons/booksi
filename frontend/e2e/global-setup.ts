import { writeBarcodeVideo } from "./barcode-video.js";
import { SCAN_ISBN, SCAN_VIDEO } from "./scan-fixture.js";
import { API_URL, WEB_URL } from "./urls.js";

/**
 * Fails the run before a single browser opens if the stack is not up.
 *
 * Without this the first spec dies on a navigation timeout or an unexplained
 * 401, and the actual problem — no database, or an API that never started — is
 * three layers below the message. The suite deliberately does not start the
 * services itself: they are long-lived development processes, and a test run
 * that stops your API when it finishes is worse than one that asks you to
 * start it.
 */
export default async function globalSetup() {
  /**
   * §D43 — the barcode Chromium will be shown instead of a camera. Written here
   * rather than committed (see `barcode-video.ts`), and before the first browser
   * starts, because the path is a launch argument.
   */
  writeBarcodeVideo(SCAN_ISBN, SCAN_VIDEO);

  const checks: [string, string][] = [
    ["API", `${API_URL}/docs-json`],
    ["web app", WEB_URL],
  ];

  for (const [name, url] of checks) {
    try {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`answered ${res.status}`);
      }
    } catch (error) {
      throw new Error(
        `The ${name} is not reachable at ${url} (${(error as Error).message}).\n\n` +
          `The end-to-end suite runs against a real stack. Start it with:\n` +
          `  npm run db:up\n` +
          `  npm run dev:api\n` +
          `  npm run dev:web\n`,
      );
    }
  }
}
