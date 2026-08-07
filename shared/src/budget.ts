import { z } from "zod";

/**
 * Sprint 6 — what the library cost, and what is left of this month's budget.
 *
 * Three rules run through every shape here, all of them from the stories:
 *
 * 1. **Only `paidPrice` counts.** The wishlist's `estimatedPrice` is a guess
 *    about a book nobody has bought (§D6), and S6.1 says outright that it never
 *    enters the budget.
 * 2. **Everything is derived, never stored.** `total_cheltuit` and
 *    `buget_ramas` are on DECISIONS.md's list of values computed on request;
 *    the sums happen in SQL over `DECIMAL(10,2)` columns so they stay exact.
 * 3. **Money with no date is money all the same.** A book bought before the
 *    library existed — typed straight in as `Terminat`, so no transition ever
 *    stamped `purchasedOn` — counts in the all-time total but belongs to no
 *    month. It is therefore missing from the chart *and* from the monthly
 *    figure, and both surfaces have to say so out loud (S6.2).
 */

/** `YYYY-MM`. A month, not a day and not an instant. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthSchema = z
  .string()
  .regex(MONTH_PATTERN, "Expected a month as YYYY-MM")
  .meta({ examples: ["2026-08"] });

/**
 * The books the dated views cannot speak for — rule 3 above, in numbers.
 *
 * Both figures, because they answer different questions: the count is "how
 * many books is this chart not showing you", the total is "and how much money
 * that is". S6.2 asks for the difference to be visible, and a count alone
 * leaves the reader subtracting two totals by hand.
 */
export const undatedSpendSchema = z.object({
  books: z.number().int(),
  total: z.number(),
});

export type UndatedSpend = z.infer<typeof undatedSpendSchema>;

/**
 * S6.1 and S6.3 in one response, because they are one screen and would
 * otherwise be two requests that can disagree about what month it is.
 */
export const budgetSummarySchema = z.object({
  /** S6.1 — every `paidPrice` in the library, dated or not. */
  total: z.number(),

  month: z.object({
    /** The month these figures are about, so the client never has to guess. */
    month: monthSchema,
    /** Spent inside it — dated purchases only. */
    spent: z.number(),
    /** S6.3, or `null` when no budget is set. */
    budget: z.number().nullable(),
    /**
     * `budget - spent`, and negative once the month is overspent — the sign is
     * the signal S6.3 asks to show, and clamping it at zero would hide exactly
     * the case worth flagging. `null` when there is no budget to subtract
     * from.
     *
     * Never carried over: each month starts from the whole budget (§D9), so
     * this is one month's arithmetic and not a running balance.
     */
    remaining: z.number().nullable(),
  }),

  undated: undatedSpendSchema,
});

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

/**
 * One purchase, named and priced, for the month tooltip.
 *
 * A total answers "how much did August cost"; it does not answer "why". The
 * three biggest purchases usually do, and they are the difference between a
 * chart you read and a chart you act on.
 */
export const monthPurchaseSchema = z.object({
  title: z.string(),
  paidPrice: z.number(),
});

export type MonthPurchase = z.infer<typeof monthPurchaseSchema>;

/** How many purchases a month's tooltip names before it starts counting. */
export const TOP_PURCHASES = 3;

export const budgetMonthSchema = z.object({
  month: monthSchema,
  spent: z.number(),

  /**
   * The month's largest purchases, dearest first, at most `TOP_PURCHASES` of
   * them. Empty for a month nobody bought anything in — those are real zeros
   * that stay in the series (see below), and a zero month has nothing to name.
   */
  top: z.array(monthPurchaseSchema),

  /**
   * How many purchases the `top` list leaves out, so the tooltip can say "și
   * încă 4" instead of implying three is all there was. Zero when the month is
   * fully named.
   */
  others: z.number().int(),
});

export type BudgetMonth = z.infer<typeof budgetMonthSchema>;

/**
 * S6.2 — the bars, oldest first.
 *
 * **Dense, including the empty months.** A month in which nothing was bought
 * is a real zero, and dropping it would put January next to April at equal
 * width — a bar chart whose axis lies about time. The series runs from the
 * first dated purchase to the current month; an empty library is an empty
 * array rather than a lone zero bar.
 */
export const budgetByMonthSchema = z.object({
  months: z.array(budgetMonthSchema),
  undated: undatedSpendSchema,
});

export type BudgetByMonth = z.infer<typeof budgetByMonthSchema>;
