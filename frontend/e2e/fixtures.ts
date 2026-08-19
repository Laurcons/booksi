import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * The seam between the Playwright suite and a running system.
 *
 * Every test gets a freshly seeded database and a signed session cookie, so the
 * specs are independent and may be run in any order — which matters here more
 * than usual, because half of them buy a book and change the state the others
 * would have read.
 */

// The frontend workspace is ESM, so there is no `__dirname` to lean on.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(HERE, "..", "..", "backend", "scripts", "e2e-seed.js");

export interface Seed {
  userId: string;
  token: string;
}

/**
 * Shelled out rather than imported: seeding needs Prisma, and the web client
 * does not get to depend on the ORM (`shared/enums.ts`). Node resolves the
 * script's own `require`s from the hoisted root `node_modules`, so nothing has
 * to be installed twice.
 */
function seedDatabase(): Seed {
  const out = execFileSync("node", [SEED], { encoding: "utf8" });

  return JSON.parse(out) as Seed;
}

/**
 * `use` below is Playwright's fixture callback, not React's — there is no React
 * anywhere in this directory. The lint plugin cannot tell the two apart by
 * name, which is why `.oxlintrc.json` turns `react/rules-of-hooks` off for
 * `e2e/**` rather than silencing it case by case.
 */
export const test = base.extend<{ seed: Seed }>({
  seed: async ({ context }, use) => {
    const seed = seedDatabase();

    // Cookies ignore ports, so one entry covers both the app on :5173 and the
    // API on :3000 — which is the whole reason the session works cross-origin
    // in development at all (§D20).
    await context.addCookies([
      {
        name: "session",
        value: seed.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await use(seed);
  },
});

/**
 * Open a book's edit form by name, from wherever the book is listed.
 *
 * Two clicks rather than one since §D40: the title opens the book's page, and
 * the form is a button on it. Worth a helper rather than two lines repeated
 * across the suite — these tests are about covers and prices, and the route to
 * the form is incidental to every one of them.
 *
 * **Waiting for the book's page to be on screen is load-bearing.** Playwright's
 * auto-waiting does not cover this one: "Editează" is also the accessible name
 * of the pencil on every row of the table being left behind
 * (`aria-label="Editează"`), so the second locator has no reason to wait — it
 * matches five or seven elements on the *old* page and fails the strict-mode
 * check. That is why the failure reads "resolved to 7 elements" rather than as
 * a timeout, and why it looks like an ambiguous selector rather than a race.
 *
 * `waitForURL` alone is **not** enough, which is worth stating because it looks
 * like it should be: routing here is client-side, so the URL changes in the same
 * tick as the click and the wait resolves while React has not yet swapped the
 * table out. It closes most of the window and leaves a race that passes
 * repeatedly and then fails — the worst kind.
 *
 * So the wait is for something only the book's page has. The back link is that
 * thing (§D41), and it cannot appear until the page it belongs to has rendered,
 * by which time the table with its pencils is gone.
 */
export async function openEditForm(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: title }).click();
  await page.waitForURL("**/books/*");
  // The book's page, actually on screen — not merely its URL in the bar.
  await expect(page.getByRole("link", { name: /Înapoi la/ })).toBeVisible();
  await page.getByRole("button", { name: "Editează" }).click();
}

export { expect };
