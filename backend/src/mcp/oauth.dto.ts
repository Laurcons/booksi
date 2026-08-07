import { z } from "zod";

/**
 * Deliberately loose: `response_type`/`code_challenge_method` are left as
 * plain strings rather than `z.literal(...)`, so an unsupported value still
 * reaches `OAuthService.buildConsentRedirect`, which can tell a malformed
 * request (safe to answer with an error *redirect*, once `client_id` and
 * `redirect_uri` are known good) from an unknown client or redirect URI
 * (never safe to redirect to — docs/MCP.md §10).
 */
export const authorizeQuerySchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  response_type: z.string().optional(),
  code_challenge: z.string().min(1),
  code_challenge_method: z.string().optional(),
  resource: z.string().min(1),
  scope: z.string().optional(),
  state: z.string().optional(),
});

export type AuthorizeQuery = z.infer<typeof authorizeQuerySchema>;

const authorizationCodeGrant = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

const refreshTokenGrant = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

export const tokenBodySchema = z.discriminatedUnion("grant_type", [
  authorizationCodeGrant,
  refreshTokenGrant,
]);

export type TokenBody = z.infer<typeof tokenBodySchema>;

export const revokeBodySchema = z.object({
  token: z.string().min(1),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

export type RevokeBody = z.infer<typeof revokeBodySchema>;

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * What `GET /oauth/authorize` signs into the `req` parameter — a
 * self-contained, short-lived claim rather than a fourth persisted entity
 * (docs/MCP.md §5 counts exactly three: `McpGrant`, `McpAuthCode`,
 * `McpToken`). Verified with the same `JWT_SECRET` as the session cookie,
 * but never confusable with one: the shape has no `sub`/`ver`, and `typ`
 * pins it to this one purpose.
 */
export interface AuthorizeRequestPayload {
  typ: "mcp_authorize";
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  state?: string;
}
