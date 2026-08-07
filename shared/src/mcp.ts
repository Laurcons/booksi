import { z } from "zod";

/**
 * What the consent screen (`/mcp/consent`) needs to render docs/MCP.md's
 * approval prompt — the client's display name, the scope it is asking for,
 * and the `redirectUri` it should be sent back to on denial (docs/MCP.md §9
 * step 3: there is no backend "deny" endpoint, the frontend redirects there
 * itself with `error=access_denied`).
 */
export const mcpConsentRequestSchema = z.object({
  clientName: z.string(),
  scope: z.string(),
  redirectUri: z.string(),
  /**
   * Echoed back on denial (`redirectUri?error=access_denied&state=...`) so
   * the client can match the failure to the request it made — there is no
   * backend "deny" endpoint, the frontend builds that redirect itself.
   */
  state: z.string().optional(),
});

export type McpConsentRequest = z.infer<typeof mcpConsentRequestSchema>;

/**
 * A connected app, as the "Connected apps" screen lists it (docs/MCP.md §9
 * step 6). Deliberately narrower than the `McpGrant` row — no token hashes,
 * same principle as `authUserSchema` narrowing `User`.
 */
export const mcpGrantSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  /** The same configured display name the consent screen showed at approval. */
  clientName: z.string(),
  scope: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type McpGrant = z.infer<typeof mcpGrantSchema>;
