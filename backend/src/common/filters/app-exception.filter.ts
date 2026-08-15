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
import { INTERNAL_ERROR_MESSAGE, type HttpErrorBody } from "@bookcsi/shared";
import type { AuditableRequest } from "../../audit/audit-request";
import { AuditService } from "../../audit/audit.service";
import { resolveAction, resolveActor, resolveSource } from "../../audit/resolve-audit-context";
import { AppError } from "../app-error";

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

  constructor(private readonly audit: AuditService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    this.maybeAudit(host, body.statusCode);
    res.status(body.statusCode).json(body);
  }

  /**
   * The other half of `AuditInterceptor`: a rejection thrown by a **guard**
   * (no session, not an admin) never reaches an interceptor, since Nest runs
   * guards first — so it never got the chance to mark the request. Anything
   * the interceptor *did* see (success or a handler-thrown error) already set
   * one of these two flags, which is what keeps this from double-logging it.
   */
  private maybeAudit(host: ArgumentsHost, statusCode: number): void {
    const request = host.switchToHttp().getRequest<AuditableRequest>();

    if (request.auditLogged || request.auditSkipped) {
      return;
    }

    const { userId, impersonatedBy } = resolveActor(request);

    this.audit.log({
      userId,
      impersonatedBy,
      source: resolveSource(request),
      action: resolveAction(undefined, request),
      method: request.method,
      route: request.route?.path ?? request.path,
      statusCode,
      outcome: "FAILURE",
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });
  }

  private toBody(exception: unknown): HttpErrorBody {
    // Already in the contract's shape, because `AppError` builds it.
    if (exception instanceof AppError) {
      return exception.getResponse() as HttpErrorBody;
    }

    // Thrown by the library, so it cannot carry a code of its own — but it is
    // as actionable as an error gets ("wait a moment"), and the client should
    // not have to recognise a bare 429 to say so.
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: "RATE_LIMITED",
        message: "Prea multe cereri într-un timp scurt. Așteaptă un moment.",
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // The case the convention is built around: a programming error, a driver
    // failure, anything unforeseen. Logged in full, reported as nothing.
    this.log.error(
      `Unhandled exception: ${exception instanceof Error ? exception.stack : String(exception)}`,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  private fromHttpException(exception: HttpException): HttpErrorBody {
    const statusCode = exception.getStatus();

    // Nest and passport raise these before any of our code runs, so they
    // arrive without a code. 401 is worth naming anyway: it is the one status
    // the client routes on rather than displays.
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return {
        statusCode,
        code: "UNAUTHENTICATED",
        message: "Sesiunea a expirat. Autentifică-te din nou.",
      };
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // A 5xx that got this far claims to be showable and has not earned it.
      // Logged with what it actually said, answered with what it should have.
      this.log.error(
        `Uncoded ${statusCode} suppressed: ${JSON.stringify(exception.getResponse())}`,
      );

      return { statusCode, message: INTERNAL_ERROR_MESSAGE };
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
