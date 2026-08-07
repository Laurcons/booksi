import { z } from "zod";
import { moneySchema } from "./book.js";

/**
 * Sprint 6's one piece of user configuration: the monthly budget of S6.3.
 *
 * The `Settings` table has carried `yearlyBudget` and `currency` since the
 * first migration, and neither appears here. S6.4 — choosing a currency — was
 * dropped, and the budget is monthly only (§D31), so exposing either would be
 * advertising a setting nothing implements. The columns stay where they are;
 * a row keeps its defaults, and the day a story asks for them they are already
 * in the schema.
 */
export const settingsSchema = z.object({
  /**
   * `null` means "no budget set", which is the ordinary state and not an
   * error: S6.1's total and S6.2's chart are useful on their own, and §D9's
   * limit is something the user opts into.
   */
  monthlyBudget: z.number().nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;

/**
 * A whole-object write, not a patch: there is exactly one field, so "send what
 * changed" and "send everything" are the same request, and requiring the key
 * makes clearing the budget (`null`) impossible to confuse with forgetting to
 * mention it.
 */
export const updateSettingsSchema = z.strictObject({
  monthlyBudget: moneySchema.nullable(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
