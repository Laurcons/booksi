import { z } from "zod";

/**
 * Pairing by code (§D37, docs/kobo_design.md §Autentificare). Google refuses
 * consent in the browser a Kobo ships, so a signed-in session gets onto the
 * device a different way: the Kobo shows a short code, a session that is
 * already authenticated types it in and approves, and the Kobo exchanges the
 * approval for its own session cookie.
 *
 * Contracts only — the flow's three steps (`backend/src/pairing`, the Kobo
 * pages, `PairKoboPage.tsx`) all read the same shapes from here rather than
 * agreeing on them by convention.
 */

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_TTL_MINUTES = 10;

/**
 * Excludes the characters a tired eye or a bad e-ink refresh confuses: no
 * `0`/`O`, no `1`/`I`/`L`. The code is read off one screen and typed on
 * another, so ambiguity here is a support request.
 */
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const pairingStatusSchema = z.enum([
  "pending",
  "approved",
  "consumed",
  "expired",
]);
export type PairingStatus = z.infer<typeof pairingStatusSchema>;

/** What `POST /pairing` returns to the Kobo when a new code is minted. */
export const createPairingResponseSchema = z.object({
  id: z.string(),
  code: z.string().length(PAIRING_CODE_LENGTH),
  expiresAt: z.iso.datetime(),
});
export type CreatePairingResponse = z.infer<typeof createPairingResponseSchema>;

/**
 * What `GET /pairing/:id` returns. The code rides along so the Kobo's waiting
 * page can keep showing it without a second cookie — this endpoint is only
 * ever called server-to-server by `kobo-frontend`, never by the device's
 * browser, so repeating the code here discloses nothing the device does not
 * already have.
 */
export const pairingStatusResponseSchema = z.object({
  status: pairingStatusSchema,
  code: z.string().length(PAIRING_CODE_LENGTH),
});
export type PairingStatusResponse = z.infer<typeof pairingStatusResponseSchema>;

/** The form on `PairKoboPage.tsx` — the code the reader typed off the Kobo's screen. */
export const approvePairingSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => value.replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().length(PAIRING_CODE_LENGTH)),
});
export type ApprovePairingInput = z.infer<typeof approvePairingSchema>;

/** What `POST /pairing/:id/consume` hands back: a session, ready to become a cookie. */
export const consumePairingResponseSchema = z.object({
  token: z.string(),
});
export type ConsumePairingResponse = z.infer<typeof consumePairingResponseSchema>;
