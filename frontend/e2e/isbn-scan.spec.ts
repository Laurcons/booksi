import { expect, test } from "./fixtures.js";
import { SCAN_ISBN, SCAN_VIDEO } from "./scan-fixture.js";

/**
 * §D43 — a real camera stream, a real decoder, in a real browser.
 *
 * This is the only level at which the feature can be shown to work at all. The
 * unit suite stubs the decoder because jsdom has neither `getUserMedia` nor
 * `BarcodeDetector`, which leaves the two things most likely to be wrong
 * untested: whether the wasm decoder actually loads and reads a frame, and
 * whether what it reads reaches the field.
 *
 * Chromium is given a Y4M file in place of a webcam, so the stream is genuine —
 * `getUserMedia` resolves, frames arrive, `detect()` runs over real pixels. Only
 * the light is synthetic.
 *
 * **Open Library is intercepted, deliberately.** Everything else here is the real
 * stack, but a test whose green depends on a third party answering over the
 * network is a test that fails for reasons that are not about this code — and
 * `playwright.config.ts` sets `retries: 0` precisely so that flakes are not
 * absorbed. The route is stubbed at our own API's edge, so the whole chain
 * inside the app is still exercised.
 *
 * Requires the stack to be up — see `npm run test:e2e`.
 */

test.use({
  // Scoped to this file: every other spec keeps a normal browser. `--use-file-…`
  // supplies the frames, `--use-fake-device-…` puts a fake camera in the device
  // list at all, and `--use-fake-ui-…` answers the permission prompt, which no
  // amount of Playwright API can click.
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${SCAN_VIDEO}`,
    ],
  },
  permissions: ["camera"],
});

const DUNE = {
  title: "Dune",
  author: "Frank Herbert",
  isbn: SCAN_ISBN,
  totalPages: 620,
  publisher: "Nemira",
  publicationYear: 1965,
  format: null,
  olEditionKey: "OL7353617M",
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

const openDialog = "Adaugă o carte";
const scanButton = "Scanează codul de bare";

test.describe("scanning an ISBN from the camera (§D43)", () => {
  test("reads the barcode and fills the book in", async ({ page, seed: _seed }) => {
    await page.route("**/openlibrary/isbn/**", (route) =>
      route.fulfill({ json: DUNE }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: openDialog }).first().click();

    // Nothing is running until it is asked for: opening the dialog must not
    // switch on a camera.
    await expect(page.getByLabel("Imagine de la cameră")).toHaveCount(0);

    await page.getByRole("button", { name: scanButton }).click();

    // The wasm decoder is fetched on this click, so the first frame takes a
    // moment longer than the rest of this suite is used to.
    await expect(page.getByLabel(/ISBN/)).toHaveValue(SCAN_ISBN, { timeout: 30_000 });

    // The point of the feature: one barcode, a filled-in book.
    await expect(page.getByLabel(/Titlu/)).toHaveValue("Dune");
    await expect(page.getByLabel(/Autor/)).toHaveValue("Frank Herbert");
    await expect(page.getByLabel("Pagini")).toHaveValue("620");
  });

  test("switches the camera off once it has the answer", async ({
    page,
    seed: _seed,
  }) => {
    await page.route("**/openlibrary/isbn/**", (route) =>
      route.fulfill({ json: DUNE }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: openDialog }).first().click();
    await page.getByRole("button", { name: scanButton }).click();

    await expect(page.getByLabel(/ISBN/)).toHaveValue(SCAN_ISBN, { timeout: 30_000 });

    // The viewfinder is gone, which is how the stream gets released — one scan,
    // one close, no second book wandering into this form.
    await expect(page.getByLabel("Imagine de la cameră")).toHaveCount(0);
  });

  test("saves the scanned book, ISBN and all", async ({ page, seed: _seed }) => {
    await page.route("**/openlibrary/isbn/**", (route) =>
      route.fulfill({ json: DUNE }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: openDialog }).first().click();
    await page.getByRole("button", { name: scanButton }).click();
    await expect(page.getByLabel(/ISBN/)).toHaveValue(SCAN_ISBN, { timeout: 30_000 });

    // S4.2's ordering, waited for rather than assumed: the scan fills the ISBN,
    // the lookup fills the rest, and saving in between would post a book with
    // no title. The old version of this test raced the fill and passed on
    // timing alone.
    await expect(page.getByLabel(/^Titlu/)).toHaveValue("Dune");

    // Scoped to the dialog and exact: the header's own "Adaugă o carte" button
    // is still on the page behind it, and a loose name matches both.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Adaugă", exact: true })
      .click();

    // All the way to the database and back out onto the table — the seed has
    // seven books, and a scanned one makes eight.
    await expect(page.locator("tbody tr")).toHaveCount(8);
    await expect(
      page.locator("tbody tr", { hasText: "Dune" }).first(),
    ).toBeVisible();
  });

  test("fetches the decoder from our own origin, never a CDN", async ({
    page,
    seed: _seed,
  }) => {
    /**
     * The assertion §D43 would otherwise only claim. `zxing-wasm` ships a
     * jsDelivr URL as its default and that string survives into the bundle — so
     * a `locateFile` override that silently did not apply would leave every test
     * here passing, with the megabyte quietly coming from a third party. That is
     * exactly the "zero cereri către alte gazde" rule (kobo_design.md §Buget de
     * pagină) the whole Open Library proxy exists to keep.
     *
     * Every host is recorded rather than just the CDN's, so this also catches
     * whatever the *next* dependency decides to phone home to.
     */
    const foreign: string[] = [];

    page.on("request", (request) => {
      const { hostname } = new URL(request.url());

      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        foreign.push(request.url());
      }
    });

    await page.route("**/openlibrary/isbn/**", (route) => route.fulfill({ json: DUNE }));

    await page.goto("/");
    await page.getByRole("button", { name: openDialog }).first().click();
    await page.getByRole("button", { name: scanButton }).click();

    // Wait for the decode, which is what proves the wasm was actually fetched
    // and run — an assertion about requests that never happened would pass on a
    // scanner that never started.
    await expect(page.getByLabel(/ISBN/)).toHaveValue(SCAN_ISBN, { timeout: 30_000 });

    expect(foreign).toEqual([]);
  });

  test("keeps the ISBN when Open Library has never heard of it", async ({
    page,
    seed: _seed,
  }) => {
    // The ordinary outcome for a Romanian edition. The barcode was still read
    // correctly, and dropping it would be the one unforgivable way to respond to
    // a successful scan.
    await page.route("**/openlibrary/isbn/**", (route) =>
      route.fulfill({
        status: 404,
        json: { statusCode: 404, message: "Open Library nu cunoaște ISBN-ul." },
      }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: openDialog }).first().click();
    await page.getByRole("button", { name: scanButton }).click();

    await expect(page.getByLabel(/ISBN/)).toHaveValue(SCAN_ISBN, { timeout: 30_000 });
    await expect(page.getByLabel(/Titlu/)).toHaveValue("");
  });
});
