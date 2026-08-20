import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@bookcsi/shared";
import type { McpAuthContext } from "../mcp/mcp-bearer.guard";

/**
 * The request as the audit trail sees it. Since §D46 only successes are logged,
 * and only from `AuditInterceptor` (the exception filter no longer audits), the
 * old `auditLogged`/`auditSkipped` coordination flags are gone — there is
 * nothing to coordinate.
 */
export interface AuditableRequest extends Request {
  user?: AuthUser;
  mcpAuth?: McpAuthContext;
  /** Set via `@AuditMetadata()` from inside a handler — see that decorator. */
  auditMetadata?: Prisma.InputJsonObject;
}
