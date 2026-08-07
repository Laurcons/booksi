import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";

@Module({
  imports: [PrismaModule],
  controllers: [StatsController],
  providers: [StatsService],
  // docs/MCP.md §9 step 5 — get_reading_stats wraps this directly.
  exports: [StatsService],
})
export class StatsModule {}
