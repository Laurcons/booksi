import { Injectable, Logger } from "@nestjs/common";
import type { AuditOutcome, AuditSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  userId?: string | null;
  impersonatedBy?: string | null;
  source: AuditSource;
  action: string;
  method: string;
  route: string;
  statusCode: number;
  outcome: AuditOutcome;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes are fire-and-forget: a row here is a record of what already
 * happened, not a precondition for it, so a slow or failing insert must
 * never be the reason a real request fails or waits.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry): void {
    try {
      void this.prisma.auditLog.create({ data: entry }).catch((error: unknown) => {
        this.logger.error(`Failed to write audit log for ${entry.action}: ${String(error)}`);
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log for ${entry.action}: ${String(error)}`);
    }
  }
}
