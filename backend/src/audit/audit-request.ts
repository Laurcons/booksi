import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@bookcsi/shared";
import type { McpAuthContext } from "../mcp/mcp-bearer.guard";

/**
 * The two booleans are how `AuditInterceptor` and `AppExceptionFilter` agree
 * on who logs a given request without double-logging it: a request that
 * reached a handler is marked by the interceptor (`auditLogged`, or
 * `auditSkipped` for a GET nobody asked to audit); one that never got past a
 * guard reaches the filter with neither set, which is the filter's cue that
 * this failure is its own to log.
 */
export interface AuditableRequest extends Request {
  user?: AuthUser;
  mcpAuth?: McpAuthContext;
  auditLogged?: boolean;
  auditSkipped?: boolean;
  /** Set via `@AuditMetadata()` from inside a handler — see that decorator. */
  auditMetadata?: Prisma.InputJsonObject;
}
