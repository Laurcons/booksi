import { expect, test } from "@playwright/test";
import { KALEIDO_APPROXIMATION_CSS, KOBO_VIEWPORT } from "./device";
import { EDIT_PAGE_BOOK, FIXTURE_SESSION_TOKEN } from "./fixtures";
import { KOBO_URL } from "./urls";

/**
 * §Mediu constraint 5 (docs/kobo_design.md): "Nicio pagină nu se derulează,
 * nici măcar cu degetul" — no page scrolls, not even by finger. Nothing in
 * `page.ts`'s base stylesheet enforces that (no `overflow: hidden`, no
 * `max-height` — see the file itself), so the rule lives entirely in content
 * budgeting: `BOOKS_PER_PAGE = 5`, three form sections, and the arithmetic
 * behind both, none of it checked against a real rendered page before now.
 * This suite is that check — `document.documentElement.scrollHeight` against
 * the panel's actual 1264px, on realistic-worst-case content, not the tidy
 * fixtures the rest of the repo uses.
 *
 * Runs under two Playwright projects (`playwright.config.ts`): `kobo-js`,
 * where `book-form-script.ts` sections the form the way a capable browser
 * would, and `kobo-no-js`, where it does not. The design document's own
 * §Buget de pagină carve-out — the unsectioned form "se derulează ca orice
 * pagină lungă dinainte de regula asta" — is `scrollAllowedWithoutJs` below;
 * every other page is held to the rule in both projects, because nothing in
 * the document exempts them.
 */

const SESSION_COOKIE_NAME = "session";

interface PageCase {
  name: string;
  path: string;
  requiresSession: boolean;
  /** The one documented exception (§Buget de pagină) — forms only, and only without JS. */
  scrollAllowedWithoutJs: boolean;
}

const PAGES: PageCase[] = [
  {
    name: "pair",
    path: "/pair",
    requiresSession: false,
    scrollAllowedWithoutJs: false,
  },
  {
    name: "books-page-1-with-dashboard",
    path: "/books",
    requiresSession: true,
    scrollAllowedWithoutJs: false,
  },
  {
    name: "books-page-2-no-dashboard",
    path: "/books?page=2",
    requiresSession: true,
    scrollAllowedWithoutJs: false,
  },
  {
    name: "book-new-empty-form",
    path: "/books/new",
    requiresSession: true,
    scrollAllowedWithoutJs: true,
  },
  {
    name: "book-edit-baseline-short-title",
    path: "/books/book-reading",
    requiresSession: true,
    scrollAllowedWithoutJs: true,
  },
  {
    name: "book-edit-worst-case-wishlist-long-title",
    path: `/books/${EDIT_PAGE_BOOK.id}`,
    requiresSession: true,
    scrollAllowedWithoutJs: true,
  },
];

for (const pageCase of PAGES) {
  test(`${pageCase.name} fits the 1264px panel without scrolling (or is the documented exception)`, async (
    { page, context },
    testInfo,
  ) => {
    if (pageCase.requiresSession) {
      await context.addCookies([
        { name: SESSION_COOKIE_NAME, value: FIXTURE_SESSION_TOKEN, url: KOBO_URL },
      ]);
    }

    await page.goto(pageCase.path);

    const scrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );

    // eslint-disable-next-line no-console
    console.log(
      `[${testInfo.project.name}] ${pageCase.path} → ${String(scrollHeight)}px (panel: ${String(KOBO_VIEWPORT.height)}px)`,
    );

    const shotBase = `test-results/kobo-screenshots/${pageCase.name}--${testInfo.project.name}`;

    // What the panel would actually show, since it never scrolls — the
    // clipped, viewport-only capture.
    await page.screenshot({ path: `${shotBase}--panel.png` });

    // The full render, overflow included when there is any — this is the one
    // that makes a violation visible rather than just measured. Skipped for
    // the no-JS project: `addStyleTag` needs script execution to inject,
    // which is exactly what that context disables, and hangs to the test
    // timeout rather than failing fast.
    if (testInfo.project.name !== "kobo-no-js") {
      await page.addStyleTag({ content: KALEIDO_APPROXIMATION_CSS });
    }
    await page.screenshot({ path: `${shotBase}--full.png`, fullPage: true });

    const isDocumentedException =
      testInfo.project.name === "kobo-no-js" && pageCase.scrollAllowedWithoutJs;

    if (isDocumentedException) {
      test.info().annotations.push({
        type: "no-js form exception (§Buget de pagină)",
        description: `rendered ${String(scrollHeight)}px tall without JS — allowed to scroll, sectioning is a JS-only enhancement`,
      });
      return;
    }

    expect(
      scrollHeight,
      `${pageCase.path} (${testInfo.project.name}) rendered ${String(scrollHeight)}px tall — ` +
        `exceeds the panel's ${String(KOBO_VIEWPORT.height)}px (§Mediu constraint 5 / §Geometrie, docs/kobo_design.md)`,
    ).toBeLessThanOrEqual(KOBO_VIEWPORT.height);
  });
}
