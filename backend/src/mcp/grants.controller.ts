import { Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { AuthUser, McpGrant } from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AppError } from "../common/app-error";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The "Connected apps" screen (docs/MCP.md §9 step 6) — a real screen the
 * moment `POST /oauth/authorize/:req/approve` stops being the only place a
 * user sees their own grants. Session-guarded like any other route (no
 * `@Public()`): this is account settings, not MCP transport.
 */
@ApiExcludeController()
@Controller("mcp/grants")
export class McpGrantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<McpGrant[]> {
    const grants = await this.prisma.mcpGrant.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const clientName = this.config.get("MCP_CLIENT_DISPLAY_NAME", { infer: true });

    return grants.map((grant) => ({
      id: grant.id,
      clientId: grant.clientId,
      clientName,
      scope: grant.scope,
      label: grant.label,
      createdAt: grant.createdAt.toISOString(),
      lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    }));
  }

  /**
   * Sets `revokedAt` — nothing else to touch. `McpBearerGuard` already reads
   * `grant.revokedAt` on every `/mcp` request, so the next call from a live
   * client is refused without a second table to keep in sync.
   */
  @AuditAction("mcp.grant.revoke")
  @Post(":id/revoke")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    const { count } = await this.prisma.mcpGrant.updateMany({
      where: { id, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count === 0) {
      // S0.3: absent and "someone else's" get the same answer.
      throw AppError.notFound("error.mcp.grantNotFound");
    }
  }
}
