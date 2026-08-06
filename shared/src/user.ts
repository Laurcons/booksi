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
});

export type AuthUser = z.infer<typeof authUserSchema>;
