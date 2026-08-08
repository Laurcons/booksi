import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule, minutes, seconds } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BooksModule } from "./books/books.module";
import { BudgetModule } from "./budget/budget.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AppExceptionFilter } from "./common/filters/app-exception.filter";
import { validateEnv } from "./config/env";
import { CoversModule } from "./covers/covers.module";
import { McpModule } from "./mcp/mcp.module";
import { OpenLibraryModule } from "./openlibrary/open-library.module";
import { PairingModule } from "./pairing/pairing.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings/settings.module";
import { StatsModule } from "./stats/stats.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
      validate: validateEnv,
    }),

    /**
     * Two windows rather than one, because they answer different questions.
     * The short one stops a burst — a runaway `useEffect`, a script hammering
     * `/auth/google` — without waiting a minute to notice. The long one is the
     * sustained ceiling, set high enough that a real session never meets it:
     * opening the app fires several queries at once, and every mutation
     * invalidates a prefix that refetches a few more.
     *
     * In-memory storage, deliberately. It is per-process, so it would not hold
     * across a horizontally scaled deployment — but this API is one process,
     * and a Redis dependency bought for a limit nobody is expected to reach is
     * a moving part with no job.
     */
    ThrottlerModule.forRoot({
      throttlers: [
        { name: "short", ttl: seconds(1), limit: 25 },
        { name: "long", ttl: minutes(1), limit: 300 },
      ],
    }),

    PrismaModule,
    AuthModule,
    BooksModule,
    // Sprint 4. `BooksModule` already pulls `CoversModule` in for the download
    // at creation; both are named here so the app's surface reads off this
    // list rather than off another module's imports.
    CoversModule,
    OpenLibraryModule,
    // Sprint 6. Read-only aggregations (§ „valori derivate”), plus the one
    // setting they read: S6.3's monthly budget.
    BudgetModule,
    SettingsModule,
    // Sprints 7–8. Read-only too, and the only place the page-counting rule
    // (§D10) is implemented — the dashboard reads it from here rather than
    // deriving its own copy over a downloaded library.
    StatsModule,
    // docs/MCP.md — resource server discovery + transport skeleton (§9 step 1).
    McpModule,
    // §D37, docs/kobo_design.md §Autentificare — pairing by code, since a Kobo
    // cannot complete the Google OAuth dance itself.
    PairingModule,
  ],
  providers: [
    // Order matters: these run in the sequence they are declared. Throttling
    // comes first so that flooding an unauthenticated route is stopped before
    // it can cost a database round trip looking the session up.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a session unless it is marked @Public() (S0.3).
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // §D27 — one shape for every error response, and the guarantee that a 5xx
    // never carries a message somebody wrote for a log file.
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule {}
