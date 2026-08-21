import type { UseFormReturn } from "react-hook-form";
import {
  CURRENCY,
  progressLabel,
  progressPercent,
  type CreateBookInput,
} from "@bookcsi/shared";
import { Field } from "./fields";
import { inputClass, lockProps } from "./styles";
import { lockedReason, type LockableField } from "./locks";
import { StatusChooser } from "./StatusChooser";
import type { BookFormValues } from "./schema";
import { useT } from "../../../i18n/locale-context";

/**
 * Tab three: where the book has got to.
 *
 * Status, progress, the three dates and the two prices — everything that
 * changes over a book's life, which is what separates this tab from `BookTab`'s
 * unchanging identity fields. The old form had these as three headed sections
 * ("Progres și evaluare", "Datele lecturii") stacked under the metadata; the
 * headings are gone because the fields say what they are.
 *
 * The dates are drawn as a line with three beads rather than as three date
 * inputs in a row. It costs nothing and it answers the question the fields are
 * really asked — how far along this book is — before any of them is read.
 */
export function ReadingTab({
  form,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
}) {
  const t = useT();
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const status = watch("status");
  const statusField = register("status");

  const pagesRead = Number(watch("pagesRead") || 0);
  // The denominator lives on the *other* tab, so it has to be read off the
  // form rather than off the book: someone who corrects a wrong page count in
  // "Carte" should see this bar move, not see it keep quoting the stored value.
  const totalPagesValue = watch("totalPages").trim();
  const totalPages = totalPagesValue === "" ? null : Number(totalPagesValue);
  const percent = progressPercent({ totalPages, pagesRead });

  const lock = (field: LockableField) => lockedReason(field, status);
  const pagesLock = lock("pagesRead");
  const paidLock = lock("paidPrice");

  return (
    /*
      `flex-1` and `justify-between`: the tab fills the panel's constant height
      and spreads its four groups down it, which is how the design lays this
      one out — status at the top, money at the bottom, and the hairlines doing
      the dividing. Anything taller than the panel scrolls instead.
    */
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-5">
      <StatusChooser
        name={statusField.name}
        value={status}
        onChange={statusField.onChange}
        onBlur={statusField.onBlur}
        inputRef={statusField.ref}
      />

      {/* S2.2 — the percentage is derived on display and never stored (§D4).
          A book with no page count gets the number alone and no bar, because
          half a bar standing in for an unknown is a lie. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-28">
            <input
              {...register("pagesRead")}
              type="number"
              min={0}
              disabled={pagesLock !== null}
              aria-label={t("field.page")}
              className={`${inputClass({ locked: pagesLock !== null, invalid: errors.pagesRead !== undefined })} tabular`}
              inputMode="numeric"
              {...lockProps(pagesLock, t)}
            />
          </div>

          {totalPages !== null && (
            <span className="tabular text-sm text-ink-3">/ {totalPages}</span>
          )}

          <span className="flex-1" />

          {percent !== null && (
            <span
              className={`tabular font-display text-[22px] leading-none ${pagesLock === null ? "text-ink" : "text-ink-3"}`}
            >
              {percent}%
            </span>
          )}
        </div>

        {errors.pagesRead?.message && (
          <span className="text-xs text-error">{errors.pagesRead.message}</span>
        )}

        {percent !== null && (
          <span
            className={`block h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ${pagesLock === null ? "" : "opacity-60"}`}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressLabel({ totalPages, pagesRead })}
          >
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
            />
          </span>
        )}
      </div>

      <hr className="border-line" />

      <Timeline form={form} />

      <hr className="border-line" />

      {/* §D6's two numbers, side by side because that is the only place either
          of them means anything. The estimate stays live after the purchase;
          what was paid is what the budget reads. */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("field.estimated")}
          htmlFor="book-form-estimated"
          error={errors.estimatedPrice}
        >
          <MoneyInput
            id="book-form-estimated"
            {...register("estimatedPrice")}
            invalid={errors.estimatedPrice !== undefined}
          />
        </Field>

        <Field
          label={t("field.paid")}
          htmlFor="book-form-paid"
          error={errors.paidPrice}
          locked={paidLock !== null}
        >
          <MoneyInput
            id="book-form-paid"
            {...register("paidPrice")}
            disabled={paidLock !== null}
            invalid={errors.paidPrice !== undefined}
            {...lockProps(paidLock, t)}
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * The three status dates, as the line they describe.
 *
 * A bead is filled when its date is known, hollow when it is not, and the
 * inputs sit under it. Locked dates come from `locks.ts` — a wishlist book has
 * no day you started it — and stay in place, recessed, rather than vanishing
 * and taking the shape of the tab with them.
 */
function Timeline({
  form,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
}) {
  const t = useT();
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const status = watch("status");

  const steps = [
    { field: "purchasedOn", label: t("book.purchasedOn"), lock: null },
    { field: "startedOn", label: t("book.startedOn"), lock: lockedReason("startedOn", status) },
    { field: "finishedOn", label: t("book.finishedOn"), lock: lockedReason("finishedOn", status) },
  ] as const;

  return (
    <div className="relative">
      {/* The rail. Horizontal between the three beads on a laptop, vertical
          down the left on a phone, and decorative either way. */}
      <span
        aria-hidden
        className="absolute left-[5px] top-2 h-[calc(100%-3rem)] w-px bg-line sm:left-[16.67%] sm:right-[16.67%] sm:top-[5px] sm:h-px sm:w-auto"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map(({ field, label, lock }) => {
          const filled = watch(field).trim() !== "";

          return (
            <div
              key={field}
              className="relative flex gap-3 sm:flex-col sm:items-center sm:gap-2"
            >
              <span
                aria-hidden
                className={
                  "relative z-10 mt-2 size-2.5 shrink-0 rounded-full border sm:mt-0 " +
                  (filled ? "border-accent bg-accent" : "border-line bg-surface-2")
                }
              />

              <Field
                label={label}
                error={errors[field]}
                locked={lock !== null}
                micro
                className="min-w-0 flex-1 sm:w-full"
                labelClassName="sm:justify-center"
              >
                <input
                  {...register(field)}
                  type="date"
                  disabled={lock !== null}
                  className={`${inputClass({ locked: lock !== null, invalid: errors[field] !== undefined })} tabular`}
                  {...lockProps(lock, t)}
                />
              </Field>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A price box with the currency inside it, so the unit is not a hint on the
 * label. Lei, always: §D6 keeps the money in one currency and `CURRENCY` is
 * the single place that says which.
 */
function MoneyInput({
  invalid = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <span className="relative block">
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${inputClass({ locked: props.disabled === true, invalid })} tabular pr-10`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3"
      >
        {CURRENCY}
      </span>
    </span>
  );
}
