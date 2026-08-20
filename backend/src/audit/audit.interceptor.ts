import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { Observable, tap } from "rxjs";
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
 * **Only successes are logged (§D46).** The trail records what people *did*,
 * not what they tried and were refused: a request that throws — a validation
 * 400, a guard rejection, anything — leaves no row. So there is no
 * `catchError` here and no coordination with `AppExceptionFilter` any more; the
 * error simply propagates untouched.
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
      // Success only — an error propagates untouched and leaves no row (§D46).
      tap(() => {
        const statusCode = response.headersSent ? response.statusCode : successStatus;
        this.audit.log(this.entry(request, action, statusCode));
      }),
    );
  }

  private entry(request: AuditableRequest, action: string | undefined, statusCode: number) {
    const { userId, impersonatedBy } = resolveActor(request);

    return {
      userId,
      impersonatedBy,
      source: resolveSource(request),
      action: resolveAction(action, request),
      method: request.method,
      route: request.route?.path ?? request.path,
      statusCode,
      ip: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
      metadata: request.auditMetadata,
    };
  }
}
