import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { BudgetByMonth, BudgetSummary, UndatedSpend } from "@bookcsi/shared";
import { toAmount, toNumber, round2 } from "../common/money";
import { currentMonth, denseMonths, monthRange } from "../common/month";
import { PrismaService } from "../prisma/prisma.service";

/**
 * A `SUM` as MariaDB hands it back through a raw query — a decimal string on
 * some drivers, a `Decimal` on others, and NULL for a group that summed to
 * nothing (which cannot happen here, since the grouping only sees non-null
 * prices).
 */
type MonthRow = { month: string; total: Prisma.Decimal | string | null };

/**
 * Sprint 6 — the budget, computed in SQL on every request and stored nowhere.
 * `total_cheltuit` and `buget_ramas` are both on DECISIONS.md's list of derived
 * values, and the sums run over `DECIMAL(10,2)` columns so that a library of a
 * thousand books totals exactly rather than nearly.
 *
 * Only `paidPrice` is ever counted. §D6 keeps the wishlist's estimate in a
 * column of its own precisely so that a guess about an unbought book cannot
 * leak into what was actually spent.
 */
@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * S6.1 and S6.3 together, because they are one screen: the all-time total,
   * this month's spending against this month's budget, and the money that has
   * no date to be attributed to.
   *
   * One response rather than two requests, so that "this month" cannot mean
   * different months in the two halves of the same page — which is exactly what
   * happens at midnight on the 1st when a client asks twice.
   */
  async summary(userId: string): Promise<BudgetSummary> {
    const month = currentMonth();
    const { start, next } = monthRange(month);

    const [all, inMonth, undated, settings] = await Promise.all([
      this.prisma.book.aggregate({
        where: { userId, paidPrice: { not: null } },
        _sum: { paidPrice: true },
      }),
      this.prisma.book.aggregate({
        where: {
          userId,
          paidPrice: { not: null },
          purchasedOn: { gte: start, lt: next },
        },
        _sum: { paidPrice: true },
      }),
      this.undatedSpend(userId),
      this.prisma.settings.findUnique({ where: { userId } }),
    ]);

    const spent = toAmount(all._sum.paidPrice);
    const spentThisMonth = toAmount(inMonth._sum.paidPrice);
    const budget = toNumber(settings?.monthlyBudget ?? null);

    return {
      total: spent,
      month: {
        month,
        spent: spentThisMonth,
        budget,
        // Negative once the month is overspent: the sign *is* the warning S6.3
        // asks for, and clamping it would hide the only case worth flagging.
        // No carry-over from last month either way (§D9).
        remaining: budget === null ? null : round2(budget - spentThisMonth),
      },
      undated,
    };
  }

  /**
   * S6.2 — spending per month, oldest first, empty months included.
   *
   * A raw query because Prisma's `groupBy` can only group by a column, and the
   * grouping key here is a *function* of one. The alternative is reading every
   * priced book and bucketing them in JavaScript, which ARCHITECTURE.md rules
   * out for these endpoints in as many words: the aggregation belongs in SQL.
   *
   * `userId` is interpolated by the tagged template, so it reaches MariaDB as a
   * bound parameter rather than as text spliced into the statement — the one
   * thing a raw query must not get wrong (S0.3).
   */
  async byMonth(userId: string): Promise<BudgetByMonth> {
    const [rows, undated] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT DATE_FORMAT(\`purchasedOn\`, '%Y-%m') AS month,
               SUM(\`paidPrice\`) AS total
        FROM \`Book\`
        WHERE \`userId\` = ${userId}
          AND \`paidPrice\` IS NOT NULL
          AND \`purchasedOn\` IS NOT NULL
        GROUP BY month
        ORDER BY month
      `,
      this.undatedSpend(userId),
    ]);

    const spending = rows.map((row) => ({
      month: row.month,
      value: toAmount(row.total),
    }));

    // `value` is what `denseMonths` calls the number so that S7.2 can share it;
    // `spent` is what this endpoint's DTO calls it.
    const months = denseMonths(spending, currentMonth()).map((entry) => ({
      month: entry.month,
      spent: entry.value,
    }));

    return { months, undated };
  }

  /**
   * The books S6.2 cannot draw: bought for a real amount, but with no
   * `purchasedOn` to place them on the axis.
   *
   * Not an edge case. A shelf typed in retroactively arrives as `Terminat`, and
   * only a transition *into* `Cumpărat` stamps a purchase date (S1.5) — so for
   * anyone entering books they already own, this is most of the library. Both
   * surfaces report it: the chart because S6.2 says the difference must be
   * visible, and the monthly figure because the same money is missing from it
   * for the same reason.
   */
  private async undatedSpend(userId: string): Promise<UndatedSpend> {
    const undated = await this.prisma.book.aggregate({
      where: { userId, paidPrice: { not: null }, purchasedOn: null },
      _sum: { paidPrice: true },
      _count: { _all: true },
    });

    return {
      books: undated._count._all,
      total: toAmount(undated._sum.paidPrice),
    };
  }
}
