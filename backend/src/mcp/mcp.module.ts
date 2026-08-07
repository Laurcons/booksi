import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { BooksModule } from "../books/books.module";
import { BudgetModule } from "../budget/budget.module";
import type { Env } from "../config/env";
import { OpenLibraryModule } from "../openlibrary/open-library.module";
import { StatsModule } from "../stats/stats.module";
import { McpAuthErrorFilter } from "./mcp-auth-error";
import { McpBearerGuard } from "./mcp-bearer.guard";
import { McpController } from "./mcp.controller";
import { McpGrantsController } from "./grants.controller";
import { McpThrottlerGuard } from "./mcp-throttler.guard";
import { OAuthController } from "./oauth.controller";
import { OAuthTokenErrorFilter } from "./oauth-token-error";
import { OAuthService } from "./oauth.service";
import { WellKnownController } from "./well-known.controller";

@Module({
  imports: [
    BooksModule,
    BudgetModule,
    StatsModule,
    OpenLibraryModule,
    // Signs the short-lived `req` param `/oauth/authorize` hands to the
    // consent screen (docs/MCP.md §9 step 3) — the same `JWT_SECRET` as the
    // session cookie, but never confusable with one: see
    // `AuthorizeRequestPayload` in `oauth.dto.ts`.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_SECRET", { infer: true }),
      }),
    }),
  ],
  controllers: [WellKnownController, McpController, OAuthController, McpGrantsController],
  providers: [
    OAuthService,
    OAuthTokenErrorFilter,
    McpBearerGuard,
    McpThrottlerGuard,
    McpAuthErrorFilter,
  ],
})
export class McpModule {}
