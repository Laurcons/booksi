import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { McpConsentRequest } from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthorizeQuery,
  AuthorizeRequestPayload,
  RevokeBody,
  TokenBody,
  TokenResponse,
} from "./oauth.dto";
import { OAuthTokenError } from "./oauth-token-error";
import {
  constantTimeEqual,
  hashToken,
  mintOpaqueToken,
  pkceChallengeFromVerifier,
} from "./token-hash";

const AUTH_CODE_TTL_MS = 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CONSENT_REQUEST_TTL = "10m";

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get clientId(): string {
    return this.config.get("MCP_CLIENT_ID", { infer: true });
  }

  private get clientSecret(): string {
    return this.config.get("MCP_CLIENT_SECRET", { infer: true });
  }

  private get redirectUris(): string[] {
    return this.config
      .get("MCP_REDIRECT_URIS", { infer: true })
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean);
  }

  private get apiOrigin(): string {
    return this.config.get("API_ORIGIN", { infer: true });
  }

  private get resourceUrl(): string {
    return `${this.apiOrigin}/mcp`;
  }

  private get webOrigin(): string {
    return this.config.get("WEB_ORIGIN", { infer: true });
  }

  private get clientDisplayName(): string {
    return this.config.get("MCP_CLIENT_DISPLAY_NAME", { infer: true });
  }

  private verifyClientCredentials(id: string, secret: string): boolean {
    return id === this.clientId && constantTimeEqual(secret, this.clientSecret);
  }

  /**
   * `GET /oauth/authorize`. `client_id`/`redirect_uri` are checked before
   * anything else and, if either is wrong, the response is a plain 400 —
   * never a redirect, because a redirect target we have not verified is
   * exactly what an attacker wants us to bounce a browser to (docs/MCP.md
   * §10). Every other problem, once the target is known good, is answered
   * *at* that target with `?error=...` — the client is the one equipped to
   * show the user something about it.
   */
  buildConsentRedirect(query: AuthorizeQuery): string {
    if (query.client_id !== this.clientId) {
      throw new BadRequestException("Unknown client_id.");
    }

    if (!this.redirectUris.includes(query.redirect_uri)) {
      throw new BadRequestException("redirect_uri is not registered for this client.");
    }

    const errorRedirect = (error: string, description: string): string => {
      const url = new URL(query.redirect_uri);
      url.searchParams.set("error", error);
      url.searchParams.set("error_description", description);
      if (query.state) {
        url.searchParams.set("state", query.state);
      }
      return url.toString();
    };

    if (query.response_type !== "code") {
      return errorRedirect("unsupported_response_type", "Only response_type=code is supported.");
    }

    if (query.code_challenge_method !== "S256") {
      return errorRedirect("invalid_request", "Only PKCE code_challenge_method=S256 is supported.");
    }

    // A SHA-256 digest, base64url-encoded without padding, is always 43
    // characters (RFC 7636) — anything else cannot be a real challenge.
    if (query.code_challenge.length !== 43) {
      return errorRedirect(
        "invalid_request",
        "code_challenge must be a base64url-encoded SHA-256 digest.",
      );
    }

    if (query.resource !== this.resourceUrl) {
      return errorRedirect("invalid_target", "resource must be this server's /mcp endpoint.");
    }

    const payload: AuthorizeRequestPayload = {
      typ: "mcp_authorize",
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      codeChallenge: query.code_challenge,
      resource: query.resource,
      scope: query.scope ?? "library",
      state: query.state,
    };

    const req = this.jwt.sign(payload, { expiresIn: CONSENT_REQUEST_TTL });
    return `${this.webOrigin}/mcp/consent?req=${encodeURIComponent(req)}`;
  }

  /** `GET /oauth/authorize/:req` — what the consent screen renders. */
  readConsentRequest(req: string): McpConsentRequest {
    const payload = this.verifyConsentRequest(req);
    return {
      clientName: this.clientDisplayName,
      scope: payload.scope,
      redirectUri: payload.redirectUri,
      state: payload.state,
    };
  }

  /**
   * `POST /oauth/authorize/:req/approve`. Reuses an existing non-revoked
   * grant for this `(user, client)` pair rather than always minting a new
   * one — reconnecting the same assistant should not silently multiply rows
   * in the revocation screen.
   */
  async approve(req: string, userId: string): Promise<{ redirectUrl: string }> {
    const payload = this.verifyConsentRequest(req);

    const grant =
      (await this.prisma.mcpGrant.findFirst({
        where: { userId, clientId: payload.clientId, revokedAt: null },
      })) ??
      (await this.prisma.mcpGrant.create({
        data: { userId, clientId: payload.clientId, scope: payload.scope },
      }));

    const rawCode = mintOpaqueToken();
    await this.prisma.mcpAuthCode.create({
      data: {
        grantId: grant.id,
        codeHash: hashToken(rawCode),
        codeChallenge: payload.codeChallenge,
        redirectUri: payload.redirectUri,
        resource: payload.resource,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });

    const url = new URL(payload.redirectUri);
    url.searchParams.set("code", rawCode);
    if (payload.state) {
      url.searchParams.set("state", payload.state);
    }
    return { redirectUrl: url.toString() };
  }

  private verifyConsentRequest(req: string): AuthorizeRequestPayload {
    let payload: AuthorizeRequestPayload;
    try {
      payload = this.jwt.verify<AuthorizeRequestPayload>(req);
    } catch {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "MCP_CONSENT_REQUEST_INVALID",
        "Cererea a expirat sau nu mai e validă. Reia conectarea din asistent.",
      );
    }

    if (payload.typ !== "mcp_authorize") {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "MCP_CONSENT_REQUEST_INVALID",
        "Cererea a expirat sau nu mai e validă. Reia conectarea din asistent.",
      );
    }

    return payload;
  }

  /** `POST /oauth/token`. Speaks RFC 6749's error vocabulary, not §D27's. */
  async exchangeToken(body: TokenBody): Promise<TokenResponse> {
    if (!this.verifyClientCredentials(body.client_id, body.client_secret)) {
      throw new OAuthTokenError(HttpStatus.UNAUTHORIZED, "invalid_client");
    }

    return body.grant_type === "authorization_code"
      ? this.exchangeAuthorizationCode(body)
      : this.exchangeRefreshToken(body);
  }

  private async exchangeAuthorizationCode(
    body: Extract<TokenBody, { grant_type: "authorization_code" }>,
  ): Promise<TokenResponse> {
    const authCode = await this.prisma.mcpAuthCode.findUnique({
      where: { codeHash: hashToken(body.code) },
      include: { grant: true },
    });

    if (!authCode || authCode.usedAt || authCode.expiresAt < new Date()) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "Unknown, used, or expired code.");
    }

    if (authCode.grant.revokedAt) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "This grant has been revoked.");
    }

    if (authCode.redirectUri !== body.redirect_uri) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "redirect_uri does not match.");
    }

    if (!constantTimeEqual(pkceChallengeFromVerifier(body.code_verifier), authCode.codeChallenge)) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "PKCE verification failed.");
    }

    // Single-use: marked before the tokens are minted, so a retry racing this
    // request finds it already spent rather than getting a second pair.
    await this.prisma.mcpAuthCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    return this.mintTokenPair(authCode.grantId, authCode.grant.scope);
  }

  private async exchangeRefreshToken(
    body: Extract<TokenBody, { grant_type: "refresh_token" }>,
  ): Promise<TokenResponse> {
    const stored = await this.prisma.mcpToken.findUnique({
      where: { tokenHash: hashToken(body.refresh_token) },
      include: { grant: true },
    });

    if (!stored || stored.type !== "REFRESH") {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "Unknown refresh token.");
    }

    if (stored.grant.revokedAt) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "This grant has been revoked.");
    }

    // A refresh token presented a second time means somebody else has a copy
    // — the whole grant is revoked, not just this token (docs/MCP.md §5).
    if (stored.replacedById) {
      await this.prisma.mcpGrant.update({
        where: { id: stored.grantId },
        data: { revokedAt: new Date() },
      });
      throw new OAuthTokenError(
        HttpStatus.BAD_REQUEST,
        "invalid_grant",
        "Refresh token already used; the grant has been revoked.",
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new OAuthTokenError(HttpStatus.BAD_REQUEST, "invalid_grant", "Refresh token expired.");
    }

    return this.mintTokenPair(stored.grantId, stored.grant.scope, stored.id);
  }

  private async mintTokenPair(
    grantId: string,
    scope: string,
    rotateFromId?: string,
  ): Promise<TokenResponse> {
    const rawAccess = mintOpaqueToken();
    const rawRefresh = mintOpaqueToken();
    const now = Date.now();

    await this.prisma.$transaction(async (tx) => {
      await tx.mcpToken.create({
        data: {
          grantId,
          type: "ACCESS",
          tokenHash: hashToken(rawAccess),
          expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
        },
      });

      const refresh = await tx.mcpToken.create({
        data: {
          grantId,
          type: "REFRESH",
          tokenHash: hashToken(rawRefresh),
          expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
        },
      });

      if (rotateFromId) {
        await tx.mcpToken.update({
          where: { id: rotateFromId },
          data: { replacedById: refresh.id },
        });
      }
    });

    return {
      access_token: rawAccess,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_MS / 1000,
      refresh_token: rawRefresh,
      scope,
    };
  }

  /**
   * `POST /oauth/revoke` (RFC 7009). Revokes the whole grant regardless of
   * which token type was presented — the grant, not the individual token, is
   * the unit of revocation here (docs/MCP.md §5). An unrecognized token is
   * not an error per RFC 7009 §2.2 — the caller cannot distinguish "already
   * gone" from "never existed", and both answer the same way.
   */
  async revoke(body: RevokeBody): Promise<void> {
    if (!this.verifyClientCredentials(body.client_id, body.client_secret)) {
      throw new OAuthTokenError(HttpStatus.UNAUTHORIZED, "invalid_client");
    }

    const stored = await this.prisma.mcpToken.findUnique({
      where: { tokenHash: hashToken(body.token) },
    });

    if (stored) {
      await this.prisma.mcpGrant.update({
        where: { id: stored.grantId },
        data: { revokedAt: new Date() },
      });
    }
  }
}
