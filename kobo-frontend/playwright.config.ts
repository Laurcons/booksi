import { defineConfig } from "@playwright/test";
import { KOBO_DEVICE_SCALE_FACTOR, KOBO_USER_AGENT, KOBO_VIEWPORT } from "./e2e/device";
import { KOBO_URL } from "./e2e/urls";

/**
 * The Kobo no-scroll suite. Separate from `vitest.config.mts` for the same
 * reason `frontend/`'s two runners are separate: this asks whether a real
 * rendered page fits the panel, vitest asks what a function does.
 *
 * Unlike `frontend/playwright.config.ts`, this suite *does* own a
 * `webServer`-equivalent — see `e2e/global-setup.ts` — because there is
 * nothing long-lived to wait for: the mock API and this app are started and
 * stopped by the suite itself, on fixed ports (`e2e/urls.ts`) chosen not to
 * collide with `dev:kobo`.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",

  fullyParallel: true,
  retries: 0,
  forbidOnly: !!process.env["CI"],

  reporter: process.env["CI"] ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: KOBO_URL,
    viewport: KOBO_VIEWPORT,
    deviceScaleFactor: KOBO_DEVICE_SCALE_FACTOR,
    userAgent: KOBO_USER_AGENT,
    trace: "retain-on-failure",
  },

  // §Buget de pagină's form-sectioning script only ever runs in a capable
  // browser — the two projects are the "with" and "without" halves of that,
  // not a browser-compatibility matrix.
  projects: [
    { name: "kobo-js", use: { javaScriptEnabled: true } },
    { name: "kobo-no-js", use: { javaScriptEnabled: false } },
  ],
});
