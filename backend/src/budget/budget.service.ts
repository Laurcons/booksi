import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  TOP_PURCHASES,
  type BudgetByMonth,
  type BudgetSummary,
  type MonthPurchase,
  type UndatedSpend,
} from "@bookcsi/shared";
import { toAmount, toNumber, round2 } from "../common/money";
import { currentMonth, denseMonths, monthRange } from "../common/month";
import { PrismaService } from "../prisma/prisma.service";

/**
 * A `SUM` as MariaDB hands it back through a raw query — a decimal string on
 * some drivers, a `Decimal` on others, and NULL for a group that summed to
 * nothing (which cannot happen here, since the grouping only sees non-null
 * prices).
 */
type MonthRow = {
  month: string;
  total: Prisma.Decimal | string | null;
  /** `COUNT(*)` comes back as a BIGINT, which the driver hands over as `bigint`. */
  books: bigint | number;
};

/** One of a month's dearest purchases, straight off the ranked query. */
type TopRow = {
  month: string;
  title: string;
  paidPrice: Prisma.Decimal | string | null;
};

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
    const [rows, top, undated] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT DATE_FORMAT(\`purchasedOn\`, '%Y-%m') AS month,
               SUM(\`paidPrice\`) AS total,
               COUNT(*) AS books
        FROM \`Book\`
        WHERE \`userId\` = ${userId}
          AND \`paidPrice\` IS NOT NULL
          AND \`purchasedOn\` IS NOT NULL
        GROUP BY month
        ORDER BY month
      `,
      this.topPurchases(userId),
      this.undatedSpend(userId),
    ]);

    const spending = rows.map((row) => ({
      month: row.month,
      value: toAmount(row.total),
    }));

    // How many purchases each month actually held, so a month showing three can
    // still say how many it is not showing.
    const counts = new Map(rows.map((row) => [row.month, Number(row.books)]));

    // `value` is what `denseMonths` calls the number so that S7.2 can share it;
    // `spent` is what this endpoint's DTO calls it.
    const months = denseMonths(spending, currentMonth()).map((entry) => {
      const named = top.get(entry.month) ?? [];

      return {
        month: entry.month,
        spent: entry.value,
        top: named,
        // The months `denseMonths` invented are absent from `counts` and hold
        // nothing, so both of these come out empty — which is the truth about a
        // month nobody bought a book in.
        others: Math.max(0, (counts.get(entry.month) ?? 0) - named.length),
      };
    });

    return { months, undated };
  }

  /**
   * The dearest few purchases of each month, for the chart's tooltip.
   *
   * One ranked query rather than a query per month: `ROW_NUMBER` partitions by
   * month inside the database and returns at most `TOP_PURCHASES` rows per
   * month, where the obvious alternative — read every priced book, group and
   * sort in JavaScript — is the shape ARCHITECTURE.md rules out for these
   * endpoints.
   *
   * The tie-break on title is not cosmetic. Two books at the same price would
   * otherwise swap places between requests, and a tooltip that reshuffles when
   * nothing changed reads as a bug.
   */
  private async topPurchases(userId: string): Promise<Map<string, MonthPurchase[]>> {
    const rows = await this.prisma.$queryRaw<TopRow[]>`
      SELECT month, title, paidPrice
      FROM (
        SELECT DATE_FORMAT(\`purchasedOn\`, '%Y-%m') AS month,
               \`title\`,
               \`paidPrice\`,
               ROW_NUMBER() OVER (
                 PARTITION BY DATE_FORMAT(\`purchasedOn\`, '%Y-%m')
                 ORDER BY \`paidPrice\` DESC, \`title\` ASC
               ) AS position
        FROM \`Book\`
        WHERE \`userId\` = ${userId}
          AND \`paidPrice\` IS NOT NULL
          AND \`purchasedOn\` IS NOT NULL
      ) ranked
      WHERE position <= ${TOP_PURCHASES}
      ORDER BY month, position
    `;

    const byMonth = new Map<string, MonthPurchase[]>();

    for (const row of rows) {
      const list = byMonth.get(row.month) ?? [];
      list.push({ title: row.title, paidPrice: toAmount(row.paidPrice) });
      byMonth.set(row.month, list);
    }

    return byMonth;
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
