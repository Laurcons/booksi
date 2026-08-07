import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { McpAuthError } from "./mcp-auth-error";
import { hashToken } from "./token-hash";

export interface McpAuthContext {
  userId: string;
  grantId: string;
}

/**
 * `/mcp`'s own auth, not the session guard's — the route is `@Public()`
 * (docs/MCP.md §7: one HTTP request carries several JSON-RPC calls, and the
 * global guard's pipeline has no view into them). Failure is always the same
 * 401 + `WWW-Authenticate` a real MCP client needs to start the OAuth dance,
 * the same header the step-1 skeleton stub answered with.
 *
 * There is no per-token `resource`/`aud` column to re-check here (§10 asks
 * for it): every token in this system was minted through a flow that already
 * verified `resource === API_ORIGIN + "/mcp"` at `/oauth/authorize`
 * (`OAuthService.buildConsentRedirect`), and there is exactly one resource
 * in this whole deployment for a token to have been issued against — the
 * check has nothing to disagree with by the time a token exists.
 */
@Injectable()
export class McpBearerGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { mcpAuth?: McpAuthContext }>();
    const res = http.getResponse<Response>();

    const token = bearerToken(req.headers.authorization);
    if (!token) {
      this.reject(res);
    }

    const stored = await this.prisma.mcpToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { grant: true },
    });

    if (
      !stored ||
      stored.type !== "ACCESS" ||
      stored.expiresAt < new Date() ||
      stored.grant.revokedAt
    ) {
      this.reject(res);
    }

    req.mcpAuth = { userId: stored.grant.userId, grantId: stored.grantId };

    // Best-effort, not on the request's critical path: a slow write here
    // must never be the reason a tool call times out.
    void this.prisma.mcpGrant
      .update({ where: { id: stored.grantId }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return true;
  }

  /**
   * Sets the header a real client needs on the raw response — Nest's own
   * 401 handling only ever sees `McpAuthError`'s body, and headers set here
   * survive `McpAuthErrorFilter`'s later `res.json()` untouched.
   */
  private reject(res: Response): never {
    const apiOrigin = this.config.get("API_ORIGIN", { infer: true });
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${apiOrigin}/.well-known/oauth-protected-resource"`,
    );
    throw new McpAuthError();
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
