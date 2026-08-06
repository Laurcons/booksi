import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import type { AuthUser } from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { Env } from "../config/env";
import { AuthService } from "./auth.service";
import { OAuthFailureFilter } from "./oauth-failure.filter";
import { SESSION_COOKIE, sessionCookieOptions } from "./session";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Kicks off the OAuth dance. The guard redirects to Google; this handler is
   * never actually reached.
   */
  @Public()
  @UseFilters(OAuthFailureFilter)
  @UseGuards(AuthGuard("google"))
  @Get("google")
  googleLogin(): void {
    // intentionally empty
  }

  /**
   * Google sends the browser back here with a code. Passport has already
   * exchanged it and run `GoogleStrategy.validate` (which created or refreshed
   * the account), so all that is left is to mint the session and hand the user
   * back to the web app.
   */
  @Public()
  @UseFilters(OAuthFailureFilter)
  @UseGuards(AuthGuard("google"))
  @Get("google/callback")
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const user = req.user as AuthUser;
    const token = this.authService.signSessionToken({ id: user.id });

    res.cookie(SESSION_COOKIE, token, this.cookieOptions());
    res.redirect(this.config.get("WEB_ORIGIN", { infer: true }));
  }

  /**
   * The frontend calls this on boot to decide between the login screen and the
   * app. A missing or expired cookie produces a 401 from the global guard,
   * which is the signal to show login.
   */
  @Get("me")
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /**
   * Explicit logout (S0.2). `clearCookie` has to repeat the attributes the
   * cookie was set with, otherwise the browser keeps the original.
   */
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
  }

  private cookieOptions() {
    return sessionCookieOptions(
      this.config.get("NODE_ENV", { infer: true }) === "production",
    );
  }
}
