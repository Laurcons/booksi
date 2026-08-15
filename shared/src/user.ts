import { z } from "zod";

/**
 * The authenticated user as `GET /auth/me` returns it. Deliberately narrower
 * than the `User` row: `googleId` is an internal join key and never leaves the
 * API.
 */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  /**
   * Set while the session is an admin impersonating someone else (§D38) — the
   * admin who started it, so the UI can show a banner and a way back. `null`
   * on an ordinary session.
   */
  impersonatedBy: z
    .object({
      id: z.string(),
      email: z.string().email(),
    })
    .nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * A row in the admin "who do I impersonate" search (§D38) — deliberately
 * narrower than `AuthUser`: `isAdmin`/`impersonatedBy` describe the caller's
 * own session, not the searched-for account.
 */
export const adminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
