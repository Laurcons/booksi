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
import {
  INTERNAL_ERROR_KEY,
  errorMessageFor,
  type HttpErrorBody,
  type Locale,
} from "@bookcsi/shared";
import { AppError } from "../app-error";
import { localeOf } from "../request-locale";
import { SchemaValidationError } from "../validated";

/**
 * §D27's second half, enforced rather than trusted.
 *
 * The convention says an error the user cannot act on should be a plain
 * `Error` that comes back as a bare 500. Nest's default filter already does
 * that much for a thrown `Error` — so the job here is the case the default
 * gets wrong: a **5xx `HttpException` carrying a message**. Nothing stops
 * somebody writing `new InternalServerErrorException(err.message)`, and Nest
 * will faithfully put the database's opinion of your connection string on a
 * user's screen. Anything 5xx without a code is rewritten, so the convention
 * cannot be broken quietly — only deliberately, by throwing an `AppError`.
 *
 * `@Catch()` with no argument, so it sees everything. Route-scoped filters
 * still win where they are declared: `OAuthFailureFilter` continues to own the
 * two OAuth routes, which redirect rather than answer with JSON.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    // §D44 — the same request the handler was given, so the same answer
    // `localeOf` gave the validator moments ago. Resolved once here rather than
    // per branch below, because a filter that worded two halves of one response
    // differently would be a hard bug to see.
    const locale = localeOf(host.switchToHttp().getRequest());
    const body = this.toBody(exception, locale);

    // §D46 — failures are not audited, so nothing to log here; the filter's
    // only job is wording the response.
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, locale: Locale): HttpErrorBody {
    // Already in the contract's shape, because `AppError` builds it — but built
    // in `DEFAULT_LOCALE`, since a service throwing one has no reader. This is
    // the point where there is one, so the sentence is chosen here (§D44).
    if (exception instanceof AppError) {
      return {
        ...(exception.getResponse() as HttpErrorBody),
        message: exception.messageFor(locale),
      };
    }

    // Already worded, and in the right language: `ValidatedBody` had the request
    // in hand and parsed with it, so re-wording here would be undoing work that
    // was done with more information than this branch has (one message per
    // broken rule, each naming its field).
    if (exception instanceof SchemaValidationError) {
      return exception.getResponse() as HttpErrorBody;
    }

    // Thrown by the library, so it cannot carry a code of its own — but it is
    // as actionable as an error gets ("wait a moment"), and the client should
    // not have to recognise a bare 429 to say so.
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: "RATE_LIMITED",
        message: errorMessageFor(locale, "error.rateLimited"),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, locale);
    }

    // The case the convention is built around: a programming error, a driver
    // failure, anything unforeseen. Logged in full, reported as nothing.
    this.log.error(
      `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: errorMessageFor(locale, INTERNAL_ERROR_KEY),
    };
  }

  private fromHttpException(
    exception: HttpException,
    locale: Locale,
  ): HttpErrorBody {
    const statusCode = exception.getStatus();

    // Nest and passport raise these before any of our code runs, so they
    // arrive without a code. 401 is worth naming anyway: it is the one status
    // the client routes on rather than displays.
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return {
        statusCode,
        code: "UNAUTHENTICATED",
        message: errorMessageFor(locale, "error.unauthenticated"),
      };
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // A 5xx that got this far claims to be showable and has not earned it.
      // Logged with what it actually said, answered with what it should have.
      this.log.error(
        `Uncoded ${statusCode} suppressed: ${JSON.stringify(exception.getResponse())}`,
      );

      return {
        statusCode,
        message: errorMessageFor(locale, INTERNAL_ERROR_KEY),
      };
    }

    // An uncoded 4xx — a route that does not exist, a method that is not
    // allowed. Nest's own body is already fit to send; there is simply no code
    // to attach, and that absence is honest.
    const response = exception.getResponse();

    return typeof response === "string"
      ? { statusCode, message: response }
      : { ...(response as Record<string, unknown>), statusCode } as HttpErrorBody;
  }
}
