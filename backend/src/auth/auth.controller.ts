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
import {
  ApiCookieAuth,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, minutes } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { AuthUser } from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { Env } from "../config/env";
import { ref } from "../docs/openapi";
import { AuthService } from "./auth.service";
import { OAuthFailureFilter } from "./oauth-failure.filter";
import { SESSION_COOKIE, sessionCookieOptions } from "./session";

/**
 * Tighter than the global ceiling, and on the two routes that deserve it: they
 * are the only ones reachable with no session at all, and a login attempt is a
 * human clicking a button — a dozen a minute is already generous, while the
 * app-wide limit is sized for a page that fires several queries at once.
 *
 * Both windows are overridden. Leaving the burst window at its default would
 * cap the minute and still let 25 requests through in the first second of it.
 */
const LOGIN_RATE = {
  short: { ttl: 1000, limit: 5 },
  long: { ttl: minutes(1), limit: 15 },
};

@ApiTags("auth")
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
  @ApiOperation({
    summary: "Pornește autentificarea cu Google",
    description:
      "S0.1 — **navigare de browser, nu un apel de API.** Google trebuie să " +
      "vadă o cerere de nivel superior, din care să poată redirecta înapoi; " +
      "un XHR e blocat. „Try it out” nu are ce demonstra aici — deschide " +
      "ruta direct în bara de adrese.\n\n" +
      "Google OAuth e singura metodă de autentificare: nu există înregistrare " +
      "cu parolă și nici flux de invitații.",
  })
  @ApiFoundResponse({ description: "Redirect către ecranul de consimțământ Google." })
  @Public()
  @Throttle(LOGIN_RATE)
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
  @ApiOperation({
    summary: "Callback-ul Google",
    description:
      "Ruta pe care o cheamă Google, nu aplicația. Contul se creează la prima " +
      "autentificare din datele profilului (S0.1), se semnează un JWT și se " +
      "pune în cookie-ul `session` — `httpOnly`, `SameSite=Lax`, `Secure` în " +
      "producție (§D20). Browserul e apoi trimis la `WEB_ORIGIN`.",
  })
  @ApiFoundResponse({
    description:
      "Redirect către aplicație, cu `Set-Cookie: session=…`. La eșec, " +
      "redirect către login — vezi `OAuthFailureFilter`.",
  })
  @Public()
  @Throttle(LOGIN_RATE)
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
  @ApiOperation({
    summary: "Utilizatorul curent",
    description:
      "Frontendul o apelează la pornire ca să aleagă între ecranul de login " +
      "și aplicație. Un 401 nu e o eroare aici, ci răspunsul „nu ești " +
      "autentificat”.\n\n" +
      "`googleId` nu iese niciodată: e o cheie internă de corelare.",
  })
  @ApiCookieAuth("session")
  @ApiOkResponse({ schema: ref("AuthUser") })
  @ApiUnauthorizedResponse({
    description: "Cookie absent, expirat, semnat greșit, sau cont șters.",
    schema: ref("HttpError"),
  })
  @Get("me")
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /**
   * Explicit logout (S0.2). `clearCookie` has to repeat the attributes the
   * cookie was set with, otherwise the browser keeps the original.
   */
  @ApiOperation({
    summary: "Delogare",
    description:
      "S0.2 — șterge cookie-ul de sesiune. Marcată `@Public()` intenționat: " +
      "un tab rămas deschis cu o sesiune deja expirată trebuie totuși să se " +
      "poată deloga, nu să primească 401 la ieșire.",
  })
  @ApiNoContentResponse({ description: "Cookie-ul de sesiune a fost șters." })
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
