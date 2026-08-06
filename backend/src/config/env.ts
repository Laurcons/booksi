import { z } from "zod";

/**
 * Validated once at boot. A missing GOOGLE_CLIENT_SECRET should stop the
 * process with a readable message, not surface as an opaque 500 the first time
 * somebody tries to log in.
 */
export const envSchema = z.object({
  /**
   * Required, deliberately without a default. Two security decisions hang off
   * this one value — `Secure` on the session cookie (§D20) and whether the
   * docs are served at all — so a default would mean an unset variable
   * silently produces the *less* safe of the two configurations on a real
   * deployment, with nothing in the logs to say so. Being made to write
   * `NODE_ENV=production` is the point.
   */
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  WEB_ORIGIN: z.string().url(),

  /**
   * How many reverse proxies sit in front of the API. Rate limiting counts per
   * client IP, and behind a proxy every request arrives from the proxy's
   * address — so without this the whole internet shares one bucket and one
   * busy user locks out everybody.
   *
   * Defaults to 0, meaning "trust nothing", because the opposite default is
   * worse: an Express that trusts `X-Forwarded-For` with no proxy in front of
   * it lets any client name its own IP and walk straight through the limiter.
   * Set it to the number of hops you actually have.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  /**
   * Swagger UI. Absent means "on outside production" — the useful default
   * either way, so nobody has to set it to work locally.
   */
  ENABLE_DOCS: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment. Copy backend/.env.example to backend/.env and fill it in.\n${details}`,
    );
  }

  return parsed.data;
}
