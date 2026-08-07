import { Injectable } from "@nestjs/common";
import type { Settings, UpdateSettingsInput } from "@bookcsi/shared";
import { toDecimal, toNumber } from "../common/money";
import { PrismaService } from "../prisma/prisma.service";

/**
 * S6.3 — the monthly budget, and for now the only thing a user configures.
 *
 * The row is created on demand rather than alongside the account: a `Settings`
 * table with one nullable column in it says exactly as much as no row at all,
 * and writing one at sign-up would put a step into S0.1 that nothing needs.
 * Reading before anything was ever saved is the ordinary first visit, not a
 * missing-record error.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async read(userId: string): Promise<Settings> {
    const row = await this.prisma.settings.findUnique({ where: { userId } });

    return { monthlyBudget: toNumber(row?.monthlyBudget ?? null) };
  }

  /**
   * Upsert, so the first save and the tenth are the same request. `null` clears
   * the budget — S6.3 is opt-in, and opting back out has to be reachable.
   */
  async update(userId: string, input: UpdateSettingsInput): Promise<Settings> {
    const monthlyBudget = toDecimal(input.monthlyBudget) ?? null;

    const row = await this.prisma.settings.upsert({
      where: { userId },
      create: { userId, monthlyBudget },
      update: { monthlyBudget },
    });

    return { monthlyBudget: toNumber(row.monthlyBudget) };
  }
}
