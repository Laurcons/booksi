import { z } from "zod";
import { localeSchema } from "./locale.js";

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
   * Which language this account reads the interface in (§D44).
   *
   * On `AuthUser` rather than left on the row for the server alone, because the
   * client is the main thing that needs it: `/auth/me` is what tells the web app
   * to stop guessing from `navigator.languages` and switch to what the user
   * actually chose.
   */
  locale: localeSchema,
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

/**
 * §D44 — the language switch.
 *
 * One field, so `PUT` rather than `PATCH` for the same reason `updateSettings`
 * is: with a single key, "send what changed" and "send everything" are the same
 * request. `strictObject` so a client that mistypes the field is told, rather
 * than having the write silently do nothing.
 *
 * It is not part of `updateSettingsSchema` because it is not in the `Settings`
 * table — the column is on `User`, alongside the other facts about the account
 * rather than about its budget, and `/auth/me` is what carries it to the client.
 */
export const updateLocaleSchema = z.strictObject({
  locale: localeSchema,
});

export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
