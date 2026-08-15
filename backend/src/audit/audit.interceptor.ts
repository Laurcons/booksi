import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { Observable, catchError, tap, throwError } from "rxjs";
import { AUDIT_ACTION_KEY } from "./audit-action.decorator";
import type { AuditableRequest } from "./audit-request";
import { AuditService } from "./audit.service";
import { resolveAction, resolveActor, resolveSource } from "./resolve-audit-context";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Global (`APP_INTERCEPTOR`, registered by `AuditModule`) — runs for every
 * controller in this process, web, Kobo-proxied, and MCP alike. `/mcp`
 * itself is the one route this can't give useful detail on: a single POST
 * there can carry several JSON-RPC tool calls (`mcp.controller.ts`), so
 * per-tool auditing happens explicitly inside `mcp/tools.ts` instead — this
 * interceptor only ever sees the outer request.
 *
 * Only mutations (and any handler explicitly marked `@AuditAction()`) are
 * logged — GETs are noise for an audit trail unless a route opts in.
 *
 * A **guard** rejection (no session, not an admin) never reaches an
 * interceptor at all — Nest runs guards first — so those are logged from
 * `AppExceptionFilter` instead. The `auditLogged`/`auditSkipped` flags this
 * sets on the request are how the two places avoid double-logging the same
 * request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuditableRequest>();
    const response = http.getResponse<Response>();

    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action && !MUTATING_METHODS.has(request.method)) {
      request.auditSkipped = true;
      return next.handle();
    }

    // What Nest itself will answer with on success — read the same way Nest
    // reads it internally, since by the time `tap` below fires, Nest has not
    // yet called `res.status()` with it *unless* the handler already sent the
    // response itself (a raw `@Res()` handler, e.g. `AuthController`'s OAuth
    // redirects) — `res.statusCode` is authoritative the moment that happened.
    const successStatus =
      this.reflector.getAllAndOverride<number | undefined>(HTTP_CODE_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? (request.method === "POST" ? 201 : 200);

    return next.handle().pipe(
      tap(() => {
        request.auditLogged = true;
        const statusCode = response.headersSent ? response.statusCode : successStatus;
        this.audit.log(this.entry(request, action, statusCode, "SUCCESS"));
      }),
      catchError((error: unknown) => {
        request.auditLogged = true;
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        this.audit.log(this.entry(request, action, statusCode, "FAILURE"));
        return throwError(() => error);
      }),
    );
  }

  private entry(
    request: AuditableRequest,
    action: string | undefined,
    statusCode: number,
    outcome: "SUCCESS" | "FAILURE",
  ) {
    const { userId, impersonatedBy } = resolveActor(request);

    return {
      userId,
      impersonatedBy,
      source: resolveSource(request),
      action: resolveAction(action, request),
      method: request.method,
      route: request.route?.path ?? request.path,
      statusCode,
      outcome,
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
      metadata: request.auditMetadata,
    };
  }
}
