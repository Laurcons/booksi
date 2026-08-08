/**
 * Fixed, unusual ports rather than the workspace's usual 3000/4000/5173 —
 * this suite starts and stops both processes itself (`global-setup.ts`), so
 * it must never collide with a real `dev:api`/`dev:kobo` a developer left
 * running in another terminal.
 */
export const MOCK_API_PORT = 4301;
export const KOBO_PORT = 4201;

export const KOBO_URL = `http://localhost:${String(KOBO_PORT)}`;
