import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
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
    });
  }

  async validate(
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
      const user = await this.authService.upsertFromGoogle(data);
      done(null, AuthService.toAuthUser(user));
    } catch (error) {
      done(error as Error);
    }
  }
}
