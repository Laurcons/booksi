import { SetMetadata } from "@nestjs/common";

export const AUDIT_ACTION_KEY = "auditAction";

/**
 * Names the action `AuditInterceptor` records for this handler
 * (`book.create`, not `POST /books`) — a route can be restructured without
 * the audit trail losing its meaning. A handler with no `@AuditAction()`
 * still gets logged, just under `"<METHOD> <route>"` (see
 * `AuditInterceptor.resolveAction`).
 */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
