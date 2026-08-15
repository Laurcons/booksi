import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, minutes } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import type { AdminUserSummary, AuthUser } from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { AuditMetadata, type SetAuditMetadata } from "../audit/audit-metadata.decorator";
import { AppError } from "../common/app-error";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import type { Env } from "../config/env";
import { arrayOf, ref } from "../docs/openapi";
import { AuthService } from "./auth.service";
import {
  GoogleCallbackGuard,
  GoogleLoginGuard,
} from "./guards/google-oauth.guard";
import { OAuthFailureFilter } from "./oauth-failure.filter";
import { sessionCookieExtractor } from "./strategies/jwt.strategy";
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
  private readonly logger = new Logger(AuthController.name);

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
  @UseGuards(GoogleLoginGuard)
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
  @AuditAction("auth.login")
  @Public()
  @Throttle(LOGIN_RATE)
  @UseFilters(OAuthFailureFilter)
  @UseGuards(GoogleCallbackGuard)
  @Get("google/callback")
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    // `GoogleStrategy` puts the whole row here, not the client-facing shape:
    // signing a session needs `tokenVersion`.
    const user = req.user as User;
    const token = this.authService.signSessionToken(user);

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
      "S0.2 — șterge cookie-ul de sesiune **și invalidează token-ul**. " +
      "Ștergerea cookie-ului singură ia doar copia din browser; token-ul e " +
      "semnat și ar rămâne valid încă 30 de zile. Delogarea incrementează " +
      "`tokenVersion`, deci se închid sesiunile de pe *toate* dispozitivele, " +
      "nu doar de pe acesta.\n\n" +
      "Marcată `@Public()` intenționat: un tab rămas deschis cu o sesiune " +
      "deja expirată trebuie totuși să se poată deloga, nu să primească 401 " +
      "la ieșire.",
  })
  @ApiNoContentResponse({ description: "Cookie-ul de sesiune a fost șters." })
  @AuditAction("auth.logout")
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // Clearing the cookie only takes the browser's copy away; the token itself
    // stays valid until it expires. Bumping the user's version is what
    // actually ends the session — see `AuthService.revokeSessions`.
    await this.authService.revokeSessions(sessionCookieExtractor(req));

    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
  }

  /**
   * §D38 — an admin takes on another account's session for support/
   * debugging. Reuses the ordinary session cookie/JWT: `sub` becomes the
   * target, so every existing `@CurrentUser()` check keeps working
   * unmodified, and the admin's own id/email ride along in the token so the
   * app can show who's driving and offer a way back.
   */
  @ApiOperation({
    summary: "Impersonează un utilizator (admin)",
    description:
      "§D38 — doar pentru conturi cu `isAdmin`. Cookie-ul de sesiune devine " +
      "cel al contului țintă; identitatea adminului rămâne în token, pentru " +
      "banner și `POST /auth/stop-impersonating`.",
  })
  @ApiNoContentResponse({ description: "Cookie-ul de sesiune a devenit cel al contului țintă." })
  @ApiForbiddenResponse({ description: "Contul autentificat nu e admin.", schema: ref("HttpError") })
  @AuditAction("auth.impersonate.start")
  @UseGuards(AdminGuard)
  @Post("impersonate/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async impersonate(
    @Param("userId") userId: string,
    @CurrentUser() admin: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @AuditMetadata() setAuditMetadata: SetAuditMetadata,
  ): Promise<void> {
    if (userId === admin.id) {
      throw AppError.validation("Nu te poți impersona pe tine însuți.");
    }

    const target = await this.authService.findById(userId);
    if (!target) {
      throw AppError.notFound();
    }

    const token = this.authService.signSessionToken(target, {
      id: admin.id,
      email: admin.email,
    });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());

    setAuditMetadata({ targetUserId: target.id, targetEmail: target.email });

    this.logger.warn(
      `${admin.email} (${admin.id}) impersonating ${target.email} (${target.id})`,
    );
  }

  /**
   * The way back out of §D38's impersonation — re-signs an ordinary token
   * for the admin who started it. Deliberately not admin-only: the caller is
   * wearing the *target's* session, who need not be an admin themselves.
   */
  @ApiOperation({
    summary: "Revine la contul propriu (admin)",
    description: "§D38 — anulează o impersonare pornită prin `POST /auth/impersonate/:userId`.",
  })
  @ApiNoContentResponse({ description: "Cookie-ul de sesiune a redevenit cel al adminului." })
  @AuditAction("auth.impersonate.stop")
  @Post("stop-impersonating")
  @HttpCode(HttpStatus.NO_CONTENT)
  async stopImpersonating(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @AuditMetadata() setAuditMetadata: SetAuditMetadata,
  ): Promise<void> {
    if (!user.impersonatedBy) {
      throw AppError.validation("Nu ești în modul impersonare.");
    }

    const admin = await this.authService.findById(user.impersonatedBy.id);
    if (!admin) {
      throw AppError.notFound();
    }

    const token = this.authService.signSessionToken(admin);
    res.cookie(SESSION_COOKIE, token, this.cookieOptions());

    setAuditMetadata({ impersonatedUserId: user.id, impersonatedEmail: user.email });

    this.logger.warn(`${admin.email} (${admin.id}) stopped impersonating ${user.email} (${user.id})`);
  }

  /**
   * Backs the admin picker (§D38) — search, not a full listing, since the
   * point is finding one account, not browsing every one.
   */
  @ApiOperation({
    summary: "Caută utilizatori (admin)",
    description: "§D38 — potrivire pe email, pentru ecranul de impersonare.",
  })
  @ApiOkResponse({ schema: arrayOf("AdminUserSummary") })
  @ApiForbiddenResponse({ description: "Contul autentificat nu e admin.", schema: ref("HttpError") })
  @UseGuards(AdminGuard)
  @Get("admin/users")
  searchUsers(
    @Query("q") q: string | undefined,
    @CurrentUser() admin: AuthUser,
  ): Promise<AdminUserSummary[]> {
    return this.authService.searchUsers(q?.trim() ?? "", admin.id);
  }

  private cookieOptions() {
    return sessionCookieOptions(
      this.config.get("NODE_ENV", { infer: true }) === "production",
    );
  }
}
