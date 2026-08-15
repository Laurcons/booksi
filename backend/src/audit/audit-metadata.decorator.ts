import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuditableRequest } from "./audit-request";

export type SetAuditMetadata = (metadata: Prisma.InputJsonObject) => void;

/**
 * Lets a handler attach extra detail (a target user, a diff) to the row
 * `AuditInterceptor` is already going to write for this request once it
 * finishes — nothing here writes on its own, so there's no risk of the
 * request ending up logged twice the way calling `AuditService` directly
 * from a controller would.
 */
export const AuditMetadata = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SetAuditMetadata => {
    const request = ctx.switchToHttp().getRequest<AuditableRequest>();

    return (metadata: Prisma.InputJsonObject) => {
      request.auditMetadata = metadata;
    };
  },
);
