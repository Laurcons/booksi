import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Response } from "express";
import type { HttpErrorBody } from "@bookcsi/shared";
import { AppError } from "../common/app-error";

/**
 * RFC 6749 §5.2's error vocabulary (`invalid_client`, `invalid_grant`, …),
 * not this app's `{statusCode, code, message}` contract (§D27). The client
 * reading `/oauth/token` and `/oauth/revoke` is a generic MCP/OAuth library,
 * not our own frontend — it parses the standard shape and nothing else.
 */
export class OAuthTokenError extends HttpException {
  constructor(status: HttpStatus, error: string, description?: string) {
    super({ error, error_description: description }, status);
  }
}

/**
 * Route-scoped, same idiom as `auth/oauth-failure.filter.ts`'s
 * `OAuthFailureFilter`: the global `AppExceptionFilter` owns every other
 * route, but `/oauth/token` and `/oauth/revoke` need to speak the protocol's
 * own error shape instead.
 */
@Catch()
export class OAuthTokenErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthTokenErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof OAuthTokenError) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // `ValidatedBody` throws this for a malformed body — the OAuth
    // equivalent is `invalid_request`, not a 500. `.message` on the exception
    // itself is not this: Nest's `HttpException` only mirrors it there when
    // the response's `message` is a string, and `AppError.validation` sends
    // an array — so the array is read back off the response body instead.
    if (exception instanceof AppError && exception.code === "VALIDATION_FAILED") {
      const { message } = exception.getResponse() as HttpErrorBody;
      res.status(HttpStatus.BAD_REQUEST).json({
        error: "invalid_request",
        error_description: Array.isArray(message) ? message.join("; ") : message,
      });
      return;
    }

    if (exception instanceof ThrottlerException) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({ error: "slow_down" });
      return;
    }

    this.logger.error(
      `Unhandled exception on an OAuth route: ${exception instanceof Error ? exception.stack : String(exception)}`,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "server_error" });
  }
}
