import type { ReactNode } from "react";
import type { Locale } from "@bookcsi/shared";
import type { TFunction } from "../../../i18n/catalog";

/**
 * The parts every tab of the book form is built from.
 *
 * Two rules are baked in here rather than left to each caller, because both are
 * easy to forget one field at a time:
 *
 * 1. **A field says its name and shows its value. Nothing else.** There is no
 *    `hint` prop any more — the old form had eight of them ("Poate lipsi",
 *    "Opțional", "ex. 13x20 cm") and they added up to a dialog that explained
 *    itself instead of being clear. What genuinely needs saying goes in `title`,
 *    where it costs no space and appears on hover.
 * 2. **A locked field looks recessed, not absent** (see `locks.ts`). One class
 *    string, applied from one place, so "disabled" cannot come out looking like
 *    four different things.
 */
export function Field({
  label,
  htmlFor,
  error,
  className = "",
  locked = false,
  children,
  trailing,
  labelClassName = "",
  micro = false,
}: {
  label: string;
  /**
   * Set when the label must point at the control by id rather than wrap it.
   *
   * Two cases need it. One is a control that is not a descendant at all — a
   * radiogroup, the category chip box. The other is any field with `trailing`
   * content or a unit inside it: a wrapping `<label>` takes its accessible name
   * from everything it contains, so "Descriere" becomes "Descriere 743 / 10 000"
   * and "Plătit" becomes "Plătit lei". Pointing at an id keeps the name the one
   * word the field is called.
   */
  htmlFor?: string;
  error?: { message?: string };
  className?: string;
  /** Dims the label to match the recessed input underneath it. */
  locked?: boolean;
  children: ReactNode;
  /** A counter, a unit, a clear button — right of the label, never below it. */
  trailing?: ReactNode;
  /** For the one caller that centres its labels: the timeline's three beads. */
  labelClassName?: string;
  /**
   * The label as a section marker rather than as a field name — 11px, uppercase,
   * tracked, `ink-3` (docs/DESIGN.md §Tipografie). Used by the timeline, whose
   * three dates read as one line rather than as three separate questions.
   */
  micro?: boolean;
}) {
  const Wrapper = htmlFor === undefined ? "label" : "div";

  return (
    <Wrapper className={`block min-w-0 ${className}`}>
      <span className={`mb-1.5 flex items-baseline justify-between gap-2 ${labelClassName}`}>
        <span
          className={
            micro
              ? "text-[11px] uppercase tracking-[.08em] text-ink-3"
              : `text-sm ${locked ? "text-ink-3" : "text-ink-2"}`
          }
        >
          {htmlFor === undefined ? label : <label htmlFor={htmlFor}>{label}</label>}
        </span>
        {trailing}
      </span>
      {children}
      {error?.message && (
        <span className="mt-1 block text-xs text-error">{error.message}</span>
      )}
    </Wrapper>
  );
}

/**
 * How much of a capped field is used up.
 *
 * Only on the two fields that have a cap worth knowing about — the description
 * (5 000) and the review (10 000) — and only as digits: `743 / 10 000` says
 * everything a sentence would. The numbers are grouped by locale, and tabular
 * so the counter does not jitter sideways as it counts (docs/DESIGN.md
 * §Tipografie).
 */
export function CharCount({
  value,
  max,
  locale,
  t,
}: {
  value: string;
  max: number;
  locale: Locale;
  t: TFunction;
}) {
  const format = new Intl.NumberFormat(locale);

  return (
    <span
      className={`tabular text-xs ${value.length > max ? "text-error" : "text-ink-3"}`}
    >
      {t("bookForm.charCount", {
        count: format.format(value.length),
        max: format.format(max),
      })}
    </span>
  );
}
