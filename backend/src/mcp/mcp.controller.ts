import { Controller, ForbiddenException, Post, Req, Res, UseFilters, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { AuditService } from "../audit/audit.service";
import { BooksService } from "../books/books.service";
import { BudgetService } from "../budget/budget.service";
import { CategoriesService } from "../categories/categories.service";
import { ChallengesService } from "../challenges/challenges.service";
import { Public } from "../common/decorators/public.decorator";
import type { Env } from "../config/env";
import { OpenLibraryService } from "../openlibrary/open-library.service";
import { StatsService } from "../stats/stats.service";
import { McpAuthErrorFilter } from "./mcp-auth-error";
import type { McpAuthContext } from "./mcp-bearer.guard";
import { McpBearerGuard } from "./mcp-bearer.guard";
import { McpThrottlerGuard } from "./mcp-throttler.guard";
import { registerTools } from "./tools";

/**
 * The MCP transport (docs/MCP.md §9 step 4). `@Public()` because a single
 * POST here carries whatever JSON-RPC calls the client makes — auth is
 * `McpBearerGuard`, not the session guard, and doesn't fit the
 * `@CurrentUser()` pipeline any real controller method uses (§7).
 */
@ApiExcludeController()
@Controller("mcp")
export class McpController {
  constructor(
    private readonly books: BooksService,
    private readonly stats: StatsService,
    private readonly budget: BudgetService,
    private readonly categories: CategoriesService,
    private readonly openLibrary: OpenLibraryService,
    private readonly challenges: ChallengesService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @UseFilters(McpAuthErrorFilter)
  @UseGuards(McpBearerGuard, McpThrottlerGuard)
  @Post()
  async handle(
    @Req() req: Request & { mcpAuth?: McpAuthContext },
    @Res() res: Response,
  ): Promise<void> {
    // DNS-rebinding protection (docs/MCP.md §7), separate from the browser
    // CORS config in §D20: `/mcp` is never meant to be called from one, so an
    // `Origin` header that does not match the web app is not a browser this
    // server expects, and is refused before anything else runs.
    const origin = req.headers.origin;
    if (origin && origin !== this.config.get("WEB_ORIGIN", { infer: true })) {
      throw new ForbiddenException("Unexpected Origin.");
    }

    // Stateless and per-request, deliberately (§7): no `AsyncLocalStorage`,
    // no server-side session, `userId` reaches the tools only through the
    // closure `registerTools` builds around this one request.
    const server = new McpServer({ name: "bookcsi", version: "1.0.0" });
    registerTools(server, {
      userId: req.mcpAuth!.userId,
      grantId: req.mcpAuth!.grantId,
      books: this.books,
      stats: this.stats,
      budget: this.budget,
      categories: this.categories,
      openLibrary: this.openLibrary,
      challenges: this.challenges,
      audit: this.audit,
    });

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    // Express has already parsed the JSON body; without passing it as the
    // third argument the transport waits on a stream that was already
    // consumed, and the request hangs (§7's documented gotcha).
    await transport.handleRequest(req, res, req.body);
  }
}
