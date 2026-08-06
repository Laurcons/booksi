import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

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

export { expect };
