import { useState } from "react";
import {
  CURRENCY,
  formatMoney,
  translateIssue,
  type BudgetSummary,
  updateSettingsSchema,
  zodErrorMap,
} from "@bookcsi/shared";
import { useUpdateSettings } from "../../api/budget";
import { errorMessage } from "../../lib/api";
import { monthLabel } from "../../lib/month";
import { useLocale } from "../../i18n/locale-context";
import { useT } from "../../i18n/locale-context";

/**
 * S6.3 — this month against this month's budget, and the form that sets it.
 *
 * Three rules from the story and §D9, all visible here:
 *
 * - **No carry-over.** Every month starts from the whole budget; last month's
 *   underspend is not this month's money, so nothing on this block accumulates.
 * - **Overspending warns, it never blocks.** The figure goes negative and the
 *   block changes colour; no button anywhere gets disabled by it.
 * - **A budget is optional.** Without one, the spending figure is still worth
 *   reading, so the block shows it and offers the field rather than nagging.
 */
export function MonthBudget({ month }: { month: BudgetSummary["month"] }) {
  const { t } = useLocale();
  const over = month.remaining !== null && month.remaining < 0;

  return (
    <div
      // No red in this app, and none invented here: the status colours are
      // reserved for book statuses (docs/DESIGN.md §Statusuri) and reusing one
      // for severity would make "abandonat" and "peste buget" the same colour.
      // Overspending is marked with the one emphasis colour there is, and said
      // in words underneath — never colour alone.
      className={
        "rounded-xl border bg-surface-1 px-8 py-7 " +
        (over ? "border-accent-quiet" : "border-line")
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
        {monthLabel(month.month, t)}
      </p>

      <p className="mt-2 font-display text-4xl text-ink tabular">
        {formatMoney(month.spent)}{" "}
        <span className="font-sans text-2xl text-ink-2">{CURRENCY}</span>
      </p>

      <p className="mt-2 text-sm text-ink-3">
        {month.budget === null ? (
          t("budget.noBudgetYet")
        ) : (
          <Remaining budget={month.budget} remaining={month.remaining ?? 0} />
        )}
      </p>

      <BudgetField budget={month.budget} />
    </div>
  );
}

/**
 * The sign is the warning. Clamping the number at zero would hide the only
 * state worth flagging, and a separate "ai depășit" badge would say the same
 * thing twice — so the sentence changes, and the figure stays arithmetic.
 */
function Remaining({ budget, remaining }: { budget: number; remaining: number }) {
  const t = useT();
  if (remaining < 0) {
    return (
      // One sentence with both figures inside it: English puts them either
      // side of the verb, so two fragments joined in JSX could not be reordered.
      <span className="text-ink-2">
        {t("budget.overspent", {
          budget: `${formatMoney(budget)} ${CURRENCY}`,
          over: `${formatMoney(Math.abs(remaining))} ${CURRENCY}`,
        })}
      </span>
    );
  }

  return (
    <span className="text-ink-2">
      {t("budget.remaining", {
        remaining: `${formatMoney(remaining)} ${CURRENCY}`,
        budget: `${formatMoney(budget)} ${CURRENCY}`,
      })}
    </span>
  );
}

/**
 * The one setting the app has (§D31).
 *
 * Validated with the API's own schema rather than a second set of rules written
 * here: `shared/` exists so that "no more than two decimals" is one sentence in
 * one place, in the language the user reads it in.
 */
/** One budget field per page, so a constant id is enough to tie the label on. */
const FIELD_ID = "monthly-budget";

function BudgetField({ budget }: { budget: number | null }) {
  const { locale, t } = useLocale();
  const [value, setValue] = useState(budget === null ? "" : formatMoney(budget));
  const [problem, setProblem] = useState<string | null>(null);
  const save = useUpdateSettings();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    // An empty field clears the budget — opting back out has to be reachable,
    // and it is the same request as setting one (§D31).
    const amount = value.trim() === "" ? null : Number(value);

    if (amount !== null && Number.isNaN(amount)) {
      setProblem(t("budget.notANumber"));
      return;
    }

    // §D44 — the same two mechanisms as the server and the book form: the parse
    // is given zod's own translations, and the keys our schema attached are
    // worded by `translateIssue`. Checked here rather than only on the server so
    // the field can object before a request is made.
    const parsed = updateSettingsSchema.safeParse(
      { monthlyBudget: amount },
      { error: zodErrorMap(locale) },
    );

    if (!parsed.success) {
      setProblem(translateIssue(locale, parsed.error.issues[0].message));
      return;
    }

    setProblem(null);
    save.mutate(parsed.data);
  };

  return (
    <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3">
      {/* `htmlFor`, not a wrapping label: the unit sits beside the input, and
          wrapping both would fold "lei" into the field's accessible name. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_ID} className="text-sm text-ink-2">
          {t("budget.monthly")}
        </label>
        <span className="flex items-center gap-2">
          <input
            id={FIELD_ID}
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("budget.noBudget")}
            className="w-32 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink tabular transition-colors duration-150 focus:border-accent-quiet focus:outline-none"
          />
          <span aria-hidden className="text-sm text-ink-3">
            {CURRENCY}
          </span>
        </span>
      </div>

      <button
        type="submit"
        disabled={save.isPending}
        className="rounded-lg border border-accent-quiet bg-accent-quiet/40 px-3.5 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-50"
      >
        {save.isPending ? t("common.saving") : t("common.save")}
      </button>

      {problem !== null && <p className="text-sm text-status-abandoned">{problem}</p>}

      {/* §D27 — the API's sentence, verbatim, whatever the status was. */}
      {save.isError && (
        <p className="text-sm text-status-abandoned">
          {errorMessage(save.error, "N-am putut salva bugetul.")}
        </p>
      )}
    </form>
  );
}
