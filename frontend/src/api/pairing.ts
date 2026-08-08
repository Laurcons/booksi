import { useMutation } from "@tanstack/react-query";
import type { ApprovePairingInput } from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

/**
 * §D37 / §Autentificare (docs/kobo_design.md) — the Kobo cannot complete
 * Google's consent screen, so a session reaches it by pairing instead: this
 * account approves a code the device is showing, and the approval is what
 * lets the Kobo mint its own session (`kobo-frontend/src/routes/pair.ts`).
 */
export function useApprovePairing() {
  return useMutation({
    mutationFn: (input: ApprovePairingInput) =>
      apiFetch<void>("/pairing/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}
