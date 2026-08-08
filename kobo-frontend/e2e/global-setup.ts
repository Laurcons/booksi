import type { Server } from "node:http";
import type { Env } from "../src/config/env";
import { createApp } from "../src/server";
import { createMockApi } from "./mock-api";
import { KOBO_PORT, MOCK_API_PORT } from "./urls";

/**
 * Unlike `frontend/e2e/global-setup.ts`, this suite does not wait for
 * long-lived dev processes — it starts its own, ephemeral, pointed at the
 * mock API instead of a real backend. Nothing here is testing whether
 * `backend/` or its database work; the whole suite is about whether a page
 * this app renders fits 1264px, which needs the real `kobo-frontend` router
 * and real HTML, but no real library behind it. Playwright runs this once,
 * before any browser opens, and calls the function it returns once, after
 * the last test finishes.
 */
export default function globalSetup(): () => Promise<void> {
  const mockApi = createMockApi();
  const mockServer: Server = mockApi.listen(MOCK_API_PORT);

  const env: Env = {
    NODE_ENV: "test",
    PORT: KOBO_PORT,
    API_URL: `http://localhost:${String(MOCK_API_PORT)}`,
    TRUST_PROXY: 0,
  };
  const koboApp = createApp(env);
  const koboServer: Server = koboApp.listen(KOBO_PORT);

  return async function globalTeardown(): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve) => koboServer.close(() => resolve())),
      new Promise<void>((resolve) => mockServer.close(() => resolve())),
    ]);
  };
}
