import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import type { Env } from "../../config/env";
import {
  newOAuthState,
  oauthStateCookieOptions,
  oauthStateMatches,
  OAUTH_STATE_COOKIE,
} from "../oauth-state";

/**
 * The two halves of the `state` check, one per leg of the OAuth round trip.
 * They are a pair — neither is any use without the other — which is why they
 * share a file rather than sitting beside the routes that use them.
 */

/**
 * The outbound leg. Mints the nonce, parks it in a cookie, and hands the same
 * value to passport so it travels to Google and comes back untouched.
 */
@Injectable()
export class GoogleLoginGuard extends AuthGuard("google") {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const state = newOAuthState();

    res.cookie(
      OAUTH_STATE_COOKIE,
      state,
      oauthStateCookieOptions(
        this.config.get("NODE_ENV", { infer: true }) === "production",
      ),
    );

    return { state };
  }
}

/**
 * The inbound leg. Checks the returned `state` against the cookie *before*
 * delegating to passport, so a forged callback is refused without its
 * authorization code ever being exchanged with Google.
 *
 * The cookie is cleared either way, which is what makes the nonce single-use: a
 * replayed callback finds nothing to match against and is refused like any
 * other stranger.
 */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard("google") {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { cookies?: Record<string, string> }>();
    const res = http.getResponse<Response>();

    const expected = req.cookies?.[OAUTH_STATE_COOKIE];
    const received = req.query.state;

    const { maxAge: _maxAge, ...options } = oauthStateCookieOptions(
      this.config.get("NODE_ENV", { infer: true }) === "production",
    );
    res.clearCookie(OAUTH_STATE_COOKIE, options);

    if (!oauthStateMatches(expected, received)) {
      // `OAuthFailureFilter` turns this into a redirect to the login screen —
      // the victim of a forged callback is a real user with a browser, not an
      // API client, and a JSON 401 in the address bar tells them nothing.
      //
      // The one throw left in the codebase that is neither an `AppError` nor a
      // plain `Error` (§D27), and deliberately so: it never becomes a response.
      // The route-scoped filter consumes it before the global one sees it, so
      // this string is a signal between two pieces of our own code — which is
      // also why it is in English and says something a log reader wants.
      throw new UnauthorizedException("OAuth state mismatch");
    }

    return (await super.canActivate(context)) as boolean;
  }
}
