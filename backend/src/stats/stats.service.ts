import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { StatsByMonth, StatsOverview } from "@bookcsi/shared";
import { toNumber } from "../common/money";
import { currentMonth, denseMonths } from "../common/month";
import { PrismaService } from "../prisma/prisma.service";

/** What an aggregate looks like coming back through a raw query. */
type Aggregate = Prisma.Decimal | string | number | null;

type OverviewRow = {
  booksFinished: Aggregate;
  booksReading: Aggregate;
  pagesRead: Aggregate;
  averageRating: Aggregate;
};

type MonthRow = { month: string; finished: Aggregate };

/**
 * Sprints 7 and 8 — the reading statistics, computed in SQL on request and
 * stored nowhere, like everything else on DECISIONS.md's "valori derivate"
 * list.
 *
 * **This class is the single home of the page-counting rule (§D10).** The term
 * used to mean two different things in three places, and the point of the
 * decision was to leave exactly one implementation. There is no second copy on
 * the client: the dashboard and the statistics page both read these numbers off
 * the wire rather than recomputing them over a downloaded library — which is
 * also what makes S8.1's "same figures on both screens" true by construction
 * rather than by discipline.
 *
 * `SUM(CASE …)` rather than `COUNT`, throughout. Prisma hands a raw `COUNT`
 * back as a `BigInt`, which `JSON.stringify` refuses outright; `SUM` arrives as
 * a decimal, which is a string or a `Decimal` and converts like every other
 * aggregate in the codebase. The typed client's own `count()` is fine and is
 * used where a query is not raw.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * S7.1, and the reading half of the S8.1 dashboard.
   *
   * One statement over one index scan, because all four figures are questions
   * about the same rows. `userId` is interpolated through the tagged template,
   * so it reaches MariaDB as a bound parameter rather than as text spliced into
   * the statement — the one thing a raw query must not get wrong (S0.3).
   */
  async overview(userId: string): Promise<StatsOverview> {
    const [row] = await this.prisma.$queryRaw<OverviewRow[]>`
      SELECT
        SUM(CASE WHEN \`status\` = 'FINISHED' THEN 1 ELSE 0 END) AS booksFinished,
        SUM(CASE WHEN \`status\` = 'READING'  THEN 1 ELSE 0 END) AS booksReading,
        SUM(CASE
          -- §D10, and the one wrinkle the table in S7.1 does not spell out: a
          -- finished book counts its whole length, because \`pagesRead\` is
          -- where the reader stopped *recording*, not where they stopped
          -- reading — nobody types 400 before ticking a 400-page novel off.
          -- Where the length was never entered (§D4 — the ordinary case, not an
          -- error) the recorded figure is all there is, and it beats counting a
          -- book somebody read as zero pages.
          WHEN \`status\` = 'FINISHED' THEN COALESCE(\`totalPages\`, \`pagesRead\`)
          WHEN \`status\` IN ('READING', 'ABANDONED') THEN \`pagesRead\`
          -- Wishlist and purchased contribute nothing: they have not been
          -- opened.
          ELSE 0
        END) AS pagesRead,
        -- \`AVG\` skips NULLs, which is exactly S7.1's rule: the average is over
        -- the books that *have* a rating, and an unrated one is absent from the
        -- denominator rather than counted as nought. Over no rated books at all
        -- it is NULL, which is the honest answer — 0 would read as a verdict.
        AVG(\`rating\`) AS averageRating
      FROM \`Book\`
      WHERE \`userId\` = ${userId}
    `;

    return {
      booksFinished: count(row?.booksFinished ?? null),
      booksReading: count(row?.booksReading ?? null),
      pagesRead: count(row?.pagesRead ?? null),
      averageRating: toNumber(row?.averageRating ?? null),
    };
  }

  /**
   * S7.2 — books finished per month, grouped on `finishedOn`.
   *
   * **The population is `FINISHED`, the same one S7.1 counts**, not "every book
   * carrying a finish date". The two differ: a re-read moves a book back to
   * `READING` and S1.5 never clears the date it already had. Counting by date
   * alone would leave the bars summing to more than the "cărți citite" figure
   * printed above them, and a reader is entitled to add up a chart and get the
   * headline.
   *
   * A raw query for the same reason as S6.2: Prisma's `groupBy` groups by a
   * column, and the key here is a *function* of one.
   */
  async byMonth(userId: string): Promise<StatsByMonth> {
    const [rows, undated] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT DATE_FORMAT(\`finishedOn\`, '%Y-%m') AS month,
               SUM(1) AS finished
        FROM \`Book\`
        WHERE \`userId\` = ${userId}
          AND \`status\` = 'FINISHED'
          AND \`finishedOn\` IS NOT NULL
        GROUP BY month
        ORDER BY month
      `,
      /**
       * The books the chart cannot place. Not an edge case: a shelf typed in
       * retroactively arrives straight in `FINISHED`, and only a transition
       * *into* that status stamps the date (S1.5) — so for anyone entering
       * books they have already read, this is most of the library.
       *
       * A count, not a sum. What is missing from a chart of books read is
       * books, and the budget's `undated` shape carries an amount of money that
       * would mean nothing here.
       */
      this.prisma.book.count({
        where: { userId, status: "FINISHED", finishedOn: null },
      }),
    ]);

    const finished = rows.map((row) => ({
      month: row.month,
      value: count(row.finished),
    }));

    // `value` is the neutral name `denseMonths` uses so that this chart and
    // S6.2's can share one implementation; `finished` is this DTO's word.
    const months = denseMonths(finished, currentMonth()).map((entry) => ({
      month: entry.month,
      finished: entry.value,
    }));

    return { months, undated };
  }
}

/**
 * A `SUM` that is conceptually a count. It comes back as a decimal, and as NULL
 * over no rows at all — an empty library has read zero books, not an unknown
 * number of them.
 */
function count(value: Aggregate): number {
  return Math.round(toNumber(value) ?? 0);
}
