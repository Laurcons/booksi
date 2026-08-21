import type { UseFormReturn } from "react-hook-form";
import type { CreateBookInput } from "@bookcsi/shared";
import { StarRatingInput } from "../StarRating";
import { CharCount, Field } from "./fields";
import { BUTTON_GHOST, TEXTAREA, lockProps } from "./styles";
import { lockedReason } from "./locks";
import { REVIEW_MAX, type BookFormValues } from "./schema";
import { useLocale, useT } from "../../../i18n/locale-context";

/**
 * Tab four: what you thought of it.
 *
 * The rating and the review are one act, which is why they share a tab and why
 * the review is not a second textarea under the description. They are also not
 * gated alike, and the difference is the interesting part of this file:
 *
 * - **The stars follow the status.** S2.3 and §D11 put a rating on a book that
 *   is finished or abandoned and nowhere else, and the API enforces it. What
 *   changed here is only how that is shown: the stars used to disappear, and
 *   now they are disabled with the reason on hover. A control you can see and
 *   cannot use tells you a rule exists; a control that is missing tells you
 *   nothing.
 * - **The review does not.** Writing about a book is not a verdict that waits
 *   for the last page — half of what is worth saying gets written while
 *   reading, and a book abandoned at page forty has a review to write and no
 *   stars to give (`shared/src/book.ts`).
 */
export function VerdictTab({
  form,
  onFinish,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
  /**
   * "I finished it" — the way out of the locked state, without going back to
   * the reading tab to hunt for the pill. It only moves the status field; the
   * save is still one button at the bottom, like every other change here.
   */
  onFinish: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const status = watch("status");
  const ratingField = register("rating");
  const ratingLock = lockedReason("rating", status);
  const review = watch("review");

  return (
    // The review takes the height the stars do not, so the tab has to be told
    // to fill the panel first — `flex-1` here is what lets `flex-1` inside the
    // field mean anything at all.
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-4" {...lockProps(ratingLock, t)}>
        <StarRatingInput
          name={ratingField.name}
          value={watch("rating") ?? ""}
          disabled={ratingLock !== null}
          clear="compact"
          onChange={ratingField.onChange}
          onBlur={ratingField.onBlur}
          inputRef={ratingField.ref}
        />

        {ratingLock !== null && (
          <>
            <span className="flex-1" />
            <button type="button" onClick={onFinish} className={BUTTON_GHOST}>
              {t("bookForm.markFinished")}
            </button>
          </>
        )}
      </div>

      {errors.rating?.message && (
        <span className="text-xs text-error">{errors.rating.message}</span>
      )}

      <hr className="border-line" />

      <Field
        label={t("field.review")}
        htmlFor="book-form-review"
        error={errors.review}
        trailing={
          <CharCount value={review} max={REVIEW_MAX} locale={locale} t={t} />
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        <textarea
          id="book-form-review"
          {...register("review")}
          className={`${TEXTAREA} h-full min-h-[13rem] flex-1`}
          placeholder={t("field.reviewPlaceholder")}
        />
      </Field>
    </div>
  );
}
