import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { Env } from "../config/env";

/**
 * The OAuth routes are reached by a browser navigation, not by fetch. A raw
 * JSON 401 would leave the user staring at `{"statusCode":401}` in the address
 * bar, so failures go back to the login screen with a flag the frontend can
 * turn into a message.
 */
@Catch()
export class OAuthFailureFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthFailureFilter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    this.logger.warn(
      `Google sign-in failed: ${exception instanceof Error ? exception.message : String(exception)}`,
    );

    const res = host.switchToHttp().getResponse<Response>();
    const webOrigin = this.config.get("WEB_ORIGIN", { infer: true });
    res.redirect(`${webOrigin}/login?error=auth`);
  }
}
