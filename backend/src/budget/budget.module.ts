import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BudgetController } from "./budget.controller";
import { BudgetService } from "./budget.service";

@Module({
  imports: [PrismaModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  // docs/MCP.md §9 step 5 — get_budget wraps this directly.
  exports: [BudgetService],
})
export class BudgetModule {}
