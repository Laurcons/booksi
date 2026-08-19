import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";
import type { Env } from "../../config/env";
import { AuthService, GoogleProfileData } from "../auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get("GOOGLE_CLIENT_ID", { infer: true }),
      clientSecret: config.get("GOOGLE_CLIENT_SECRET", { infer: true }),
      callbackURL: config.get("GOOGLE_CALLBACK_URL", { infer: true }),
      // Nothing beyond identity: we never touch the user's Google data.
      scope: ["email", "profile"],
      // §D44 — a first login seeds the account's language from the device, and
      // the only place that is legible is the request's `Accept-Language`. This
      // is Google redirecting the user's own browser back to us, so the header
      // is the browser's, not Google's.
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      // Every Google account has one, but the field is optional in the type
      // and an account without it cannot satisfy our unique email column.
      done(new UnauthorizedException("Google account has no e-mail address"));
      return;
    }

    const data: GoogleProfileData = {
      googleId: profile.id,
      email,
      name: profile.displayName || null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };

    try {
      // The whole row, not `toAuthUser`: the callback has to sign a session
      // from it, and that needs `tokenVersion`, which the client-facing shape
      // deliberately does not carry. Nothing serialises `req.user` on this
      // route — it only mints a cookie and redirects — so the wider object
      // never leaves the process.
      const user = await this.authService.upsertFromGoogle(
        data,
        req.headers["accept-language"],
      );
      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }
}
