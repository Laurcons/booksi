import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthUser, McpConsentRequest } from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import {
  authorizeQuerySchema,
  revokeBodySchema,
  tokenBodySchema,
  type AuthorizeQuery,
  type RevokeBody,
  type TokenBody,
  type TokenResponse,
} from "./oauth.dto";
import { OAuthTokenErrorFilter } from "./oauth-token-error";
import { OAuthService } from "./oauth.service";
import { ValidatedBody, ValidatedQuery } from "../common/validated";

/**
 * The hand-rolled OAuth 2.1 authorization server (docs/MCP.md §9 step 3).
 * `@ApiExcludeController` — this speaks RFC 6749/8414/9728 to MCP client
 * libraries, not the app's own documented REST surface; a Swagger entry
 * would describe a contract nobody calling it reads.
 */
@ApiExcludeController()
@Controller("oauth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /**
   * Browser navigation, not an API call — same reasoning as
   * `AuthController.googleLogin`. `client_id`/`redirect_uri` failures come
   * back as a plain 400 (never a redirect, docs/MCP.md §10); everything else
   * lands the browser on `/mcp/consent` or bounces back to the client's own
   * `redirect_uri` with `?error=...`.
   */
  @Public()
  @Get("authorize")
  authorize(
    @ValidatedQuery(authorizeQuerySchema) query: AuthorizeQuery,
    @Res() res: Response,
  ): void {
    res.redirect(this.oauth.buildConsentRedirect(query));
  }

  /** What `/mcp/consent` fetches to render the approval prompt. Session-guarded. */
  @Get("authorize/:req")
  consentRequest(@Param("req") req: string): McpConsentRequest {
    return this.oauth.readConsentRequest(req);
  }

  /**
   * Mints the authorization code and hands back the URL to redirect to —
   * the frontend navigates there itself (`window.location.href`), since
   * this is a `fetch` call, not the top-level navigation the OAuth redirect
   * needs to be.
   */
  @AuditAction("mcp.grant.approve")
  @Post("authorize/:req/approve")
  approve(
    @Param("req") req: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ redirectUrl: string }> {
    return this.oauth.approve(req, user.id);
  }

  @Public()
  @UseFilters(OAuthTokenErrorFilter)
  @Post("token")
  @HttpCode(HttpStatus.OK)
  token(
    @ValidatedBody(tokenBodySchema) body: TokenBody,
  ): Promise<TokenResponse> {
    return this.oauth.exchangeToken(body);
  }

  @Public()
  @UseFilters(OAuthTokenErrorFilter)
  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  async revoke(
    @ValidatedBody(revokeBodySchema) body: RevokeBody,
  ): Promise<Record<string, never>> {
    await this.oauth.revoke(body);
    return {};
  }
}
