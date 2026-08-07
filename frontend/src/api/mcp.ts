import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { McpConsentRequest, McpGrant } from "@bookcsi/shared";
import { apiFetch } from "../lib/api";

export const MCP_CONSENT_KEY = ["mcp", "consent"] as const;
export const MCP_GRANTS_KEY = ["mcp", "grants"] as const;

/** What `/mcp/consent` renders — the client's name, scope, and where to send the user next. */
export function useConsentRequest(req: string) {
  return useQuery({
    queryKey: [...MCP_CONSENT_KEY, req] as const,
    queryFn: () => apiFetch<McpConsentRequest>(`/oauth/authorize/${encodeURIComponent(req)}`),
    retry: false,
  });
}

/**
 * Mints the authorization code and hands back the URL to leave the app
 * through — the caller navigates there itself with a top-level redirect
 * (`window.location.href`), not client-side routing, since approval ends
 * the browser's business with bookcsi for this flow.
 */
export function useApproveConsent(req: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ redirectUrl: string }>(`/oauth/authorize/${encodeURIComponent(req)}/approve`, {
        method: "POST",
      }),
  });
}

/** The "Connected apps" screen — active connectors, oldest revocation first to newest. */
export function useGrants() {
  return useQuery({
    queryKey: MCP_GRANTS_KEY,
    queryFn: () => apiFetch<McpGrant[]>("/mcp/grants"),
  });
}

export function useRevokeGrant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/mcp/grants/${id}/revoke`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MCP_GRANTS_KEY }),
  });
}
