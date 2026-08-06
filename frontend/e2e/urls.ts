/**
 * Where the running stack is.
 *
 * Both are overridable, but the defaults are not arbitrary: credentialed CORS
 * allows exactly one origin (§D20), so the app has to be served from the same
 * `WEB_ORIGIN` the API was configured with — driving a second Vite instance on
 * :5174 fails CORS, not the assertion.
 */
export const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:5173";
export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000";
