import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-jwt";
import type { AuthUser } from "@bookcsi/shared";
import type { Env } from "../../config/env";
import { AuthService, SessionPayload } from "../auth.service";
import { SESSION_COOKIE } from "../session";

/**
 * Reads the session out of the httpOnly cookie. Deliberately *not*
 * `fromAuthHeaderAsBearerToken`: accepting a header too would reintroduce the
 * localStorage-token pattern §D20 exists to prevent.
 */
export function sessionCookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: sessionCookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_SECRET", { infer: true }),
    });
  }

  /**
   * The token is only a claim about *who*; the row is the authority on whether
   * that user still exists. A deleted account must not keep working until its
   * cookie happens to expire.
   */
  async validate(payload: SessionPayload): Promise<AuthUser> {
    const user = await this.authService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return AuthService.toAuthUser(user);
  }
}
