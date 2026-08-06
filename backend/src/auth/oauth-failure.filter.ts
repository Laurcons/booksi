import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThrottlerException } from "@nestjs/throttler";
import type { Response } from "express";
import type { Env } from "../config/env";

/**
 * The OAuth routes are reached by a browser navigation, not by fetch. A raw
 * JSON 401 would leave the user staring at `{"statusCode":401}` in the address
 * bar, so failures go back to the login screen with a flag the frontend can
 * turn into a message.
 *
 * Still `@Catch()`, because passport reports failure as any of several
 * unrelated error types and enumerating them is how one gets missed. The cost
 * of that breadth is that this filter sees exceptions the *framework* raised as
 * well as the ones the strategy did — so anything with its own meaning has to
 * be told apart here, or it arrives at the login screen wearing the wrong
 * message. `ThrottlerException` is the first such case and the reason this
 * comment exists: rate limiting is not a failed sign-in, and telling somebody
 * to "try again" is precisely the wrong instruction to give them.
 */
@Catch()
export class OAuthFailureFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthFailureFilter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const throttled = exception instanceof ThrottlerException;

    if (throttled) {
      this.logger.warn("Google sign-in rate limited");
    } else {
      this.logger.warn(
        `Google sign-in failed: ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    }

    const res = host.switchToHttp().getResponse<Response>();
    const webOrigin = this.config.get("WEB_ORIGIN", { infer: true });

    res.redirect(`${webOrigin}/login?error=${throttled ? "rate" : "auth"}`);
  }
}
