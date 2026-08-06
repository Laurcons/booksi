import { defineConfig, devices } from "@playwright/test";
import { WEB_URL } from "./e2e/urls.js";

/**
 * The end-to-end suite. Separate from the vitest run on purpose — `vite.config`
 * globs `src/**` only, so the two never collide, and they answer different
 * questions: vitest asks what a component does, this asks whether the three
 * services agree.
 *
 * Not started automatically (no `webServer`): the API and the database are
 * long-lived development processes, and `e2e/global-setup.ts` says so plainly
 * instead of starting and stopping them underneath you.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  // Every test reseeds the same database, so they cannot share it concurrently.
  workers: 1,
  fullyParallel: false,

  // A failure here is a real failure. Retrying would only hide the flake that
  // a shared database and a real network can produce, and hiding it is how it
  // reaches a sprint review.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: WEB_URL,
    // Kept only for the runs that fail, which is when they are worth having.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
