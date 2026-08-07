import path from "node:path";
import { z } from "zod";

/**
 * The backend gets `.env` parsing for free from `@nestjs/config`. Nothing does
 * that here, so it has to be asked for — otherwise a filled-in `.env` sits on
 * disk next to a process that only ever reads the real environment, and the
 * boot error tells you to create the file you already created.
 *
 * `process.loadEnvFile` is built into Node, so no dotenv dependency. Two
 * properties of it matter:
 *
 * - Variables already set in the real environment win over the file. That is
 *   the behaviour a container wants, where the file is absent and the values
 *   are injected.
 * - It throws when the file does not exist, which is why a missing file is
 *   swallowed and everything else is not. In production there is deliberately
 *   no `.env`.
 *
 * The path is resolved from this module rather than from the working
 * directory: `npm run dev:kobo` and `node kobo-frontend/dist/main.js` run with
 * different ones, and only one of them would find a relative path.
 */
export function loadDotEnv(file = path.join(__dirname, "..", "..", ".env")): void {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

/**
 * Validated once at boot, the same way `backend/src/config/env.ts` does it and
 * for the same reason: a missing API_URL should stop the process with a
 * readable message rather than turn into a connection error on the first page
 * somebody opens.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(4000),

  /**
   * Where the Nest API lives, from *this process's* point of view — an
   * internal address, not the public one. Nothing here talks to the API from a
   * browser, so CORS and `WEB_ORIGIN` (§D20) never enter into it; requests go
   * server to server with the reader's session cookie forwarded along.
   */
  API_URL: z.string().url(),

  /**
   * How many reverse proxies sit in front. Unlike the backend's copy this is
   * not about rate limiting — it decides whether `X-Forwarded-Proto` is
   * believed, which is what the probe reports as "did this arrive over TLS".
   * Same default and same argument: trusting the header with no proxy in front
   * lets a client claim whatever it likes.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment. Copy kobo-frontend/.env.example to kobo-frontend/.env and fill it in.\n${details}`,
    );
  }

  return parsed.data;
}
