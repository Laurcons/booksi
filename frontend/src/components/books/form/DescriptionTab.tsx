import type { UseFormReturn } from "react-hook-form";
import type { CreateBookInput } from "@bookcsi/shared";
import { CharCount, Field } from "./fields";
import { TEXTAREA } from "./styles";
import { DESCRIPTION_MAX, type BookFormValues } from "./schema";
import { useLocale, useT } from "../../../i18n/locale-context";

/**
 * Tab two: one field, the whole tab.
 *
 * §D40's description is the only prose on the book that is *about* the book,
 * and in the old single-page form it sat in the grid between the ISBN and the
 * page count with five rows of height. Giving it a tab of its own is the
 * cheapest possible fix and the one the field has wanted all along: a synopsis
 * is written in paragraphs, and paragraphs need a box the size of a page.
 *
 * The counter is the only other thing on the tab. There used to be a line
 * explaining that Claude can write this field over MCP; the person reading it
 * is the person who set that up.
 */
export function DescriptionTab({
  form,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const description = watch("description");

  return (
    <Field
      label={t("field.description")}
      htmlFor="book-form-description"
      error={errors.description}
      trailing={
        <CharCount value={description} max={DESCRIPTION_MAX} locale={locale} t={t} />
      }
      className="flex min-h-0 flex-1 flex-col"
    >
      <textarea
        id="book-form-description"
        {...register("description")}
        className={`${TEXTAREA} h-full min-h-[16rem] flex-1`}
        placeholder={t("field.descriptionPlaceholder")}
      />
    </Field>
  );
}
