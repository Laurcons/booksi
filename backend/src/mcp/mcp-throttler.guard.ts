import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { McpAuthContext } from "./mcp-bearer.guard";

/**
 * `/mcp`'s own bucket, in addition to the app-wide IP-keyed one that still
 * runs first (the global `APP_GUARD` isn't route-removable, and there is no
 * reason to want it gone — it is what stops a flood of invalid tokens before
 * any of this code runs). What this guard adds is fairness *after* auth: a
 * hosted connector serving many users from one address must not let one
 * user's burst throttle everybody else's (docs/MCP.md §7).
 *
 * Listed after `McpBearerGuard` in `@UseGuards(...)` on purpose — Nest runs
 * guards in that order, so `req.mcpAuth` is always set by the time this one
 * runs; the IP fallback below exists only so a missing grant fails toward
 * "throttled like anyone else" rather than throwing.
 */
@Injectable()
export class McpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const grantId = (req as { mcpAuth?: McpAuthContext }).mcpAuth?.grantId;
    return grantId ?? super.getTracker(req);
  }
}
