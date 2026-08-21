import { useState, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CreateBookInput } from "@bookcsi/shared";
import { AuthorInput } from "../AuthorInput";
import { CategoryPicker } from "../CategoryPicker";
import { IsbnScanner } from "../IsbnScanner";
import { Field } from "./fields";
import { BUTTON_GHOST, INPUT, inputClass } from "./styles";
import type { BookFormValues } from "./schema";
import { useT } from "../../../i18n/locale-context";

/**
 * Tab one: what the book *is*.
 *
 * Everything here is a property of the object on the shelf rather than of the
 * reading of it — title, author, edition, which shelves it sits on. That split
 * is the reason the tabs exist at all: this tab is filled in once and then
 * mostly left alone, while `ReadingTab` changes every few days.
 *
 * The cover and the Open Library search arrive as nodes rather than being built
 * here, because both of them need queries and one of them only exists while
 * adding. This tab stays a layout.
 */
export function BookTab({
  form,
  cover,
  openLibrary,
  notes,
}: {
  form: UseFormReturn<BookFormValues, unknown, CreateBookInput>;
  cover: ReactNode;
  /** The search box, while adding. Absent while editing — §D12 stops short of
   *  offering someone a different book in the middle of correcting this one. */
  openLibrary?: ReactNode;
  /** The duplicate-ISBN warning and the lookup's own line, when either applies. */
  notes: ReactNode;
}) {
  const t = useT();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  /**
   * §D43 — whether the camera is on. Mounting `IsbnScanner` is what opens it and
   * unmounting is what releases it, so this flag is the camera's on/off switch
   * rather than merely a visibility toggle.
   */
  const [scanning, setScanning] = useState(false);

  const authorField = register("author");

  return (
    <div className="flex flex-col gap-4">
      {openLibrary}

      {/*
        The identity block, as designed: the cover on the left with the title,
        the author and the ISBN beside it.

        A grid rather than nested flex rows because the cover spans a different
        number of rows at each width — two on a phone, where the ISBN drops
        below it and takes the full line, three on a laptop, where it sits in
        the column. One element, placed twice, instead of two copies of the same
        input in the DOM.
      */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4">
        <div className="row-span-2 sm:row-span-3">{cover}</div>

        <Field label={t("field.title")} error={errors.title}>
          <input
            {...register("title")}
            className={inputClass({ invalid: errors.title !== undefined })}
            autoComplete="off"
          />
        </Field>

        <Field label={t("field.author")} error={errors.author}>
          <AuthorInput
            name={authorField.name}
            value={watch("author")}
            className={INPUT}
            onChange={authorField.onChange}
            onBlur={authorField.onBlur}
            inputRef={authorField.ref}
            onSelect={(author) => setValue("author", author, { shouldDirty: true })}
          />
        </Field>

        <div className="col-span-2 grid gap-4 sm:col-span-1 sm:grid-cols-2">
          <Field label="ISBN" error={errors.isbn}>
            <div className="flex items-center gap-2">
              <input
                {...register("isbn")}
                className={inputClass({ invalid: errors.isbn !== undefined })}
                autoComplete="off"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setScanning((on) => !on)}
                aria-pressed={scanning}
                title={t("bookForm.scanBarcode")}
                className={BUTTON_GHOST}
              >
                {/* The label carries the meaning; the glyph is decoration, so it
                    is hidden rather than read out as punctuation. */}
                <span aria-hidden>▥</span>
                <span className="sr-only">{t("bookForm.scanBarcode")}</span>
              </button>
            </div>
          </Field>

          <Field label={t("field.pagesShort")} error={errors.totalPages}>
            <input
              {...register("totalPages")}
              type="number"
              min={1}
              className={`${inputClass({ invalid: errors.totalPages !== undefined })} tabular`}
              inputMode="numeric"
            />
          </Field>
        </div>

        {scanning && (
          <div className="col-span-2 sm:col-span-1 sm:col-start-2">
            <IsbnScanner
              onFound={(scanned) => {
                /**
                 * §D43 — `shouldDirty` is the whole integration, and it is the
                 * one line that would silently do nothing if it were left out:
                 * the ISBN lookup is gated on `dirtyFields.isbn`, so a value
                 * set quietly here would fill the field and then fetch nothing,
                 * which looks exactly like Open Library being down.
                 */
                setValue("isbn", scanned, { shouldDirty: true, shouldValidate: true });
                // One scan, one close. Leaving the camera running after a hit
                // invites a second book being scanned into a form that is
                // already about the first.
                setScanning(false);
              }}
              onClose={() => setScanning(false)}
            />
          </div>
        )}

        {notes && <div className="col-span-2 sm:col-span-1 sm:col-start-2">{notes}</div>}
      </div>

      <hr className="border-line" />

      {/* Edition trivia: absent on most books (§D4), and never the reason the
          dialog was opened. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label={t("field.publisher")} error={errors.publisher} className="col-span-2 sm:col-span-1">
          <input {...register("publisher")} className={INPUT} autoComplete="off" />
        </Field>

        <Field label={t("field.yearShort")} error={errors.publicationYear}>
          <input
            {...register("publicationYear")}
            type="number"
            min={1400}
            className={`${inputClass({ invalid: errors.publicationYear !== undefined })} tabular`}
            inputMode="numeric"
          />
        </Field>

        <Field label={t("field.volume")} error={errors.volume}>
          <input
            {...register("volume")}
            type="number"
            min={1}
            className={`${inputClass({ invalid: errors.volume !== undefined })} tabular`}
            inputMode="numeric"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label={t("field.format")} error={errors.format}>
          <input
            {...register("format")}
            className={INPUT}
            autoComplete="off"
            title={t("field.formatHint")}
          />
        </Field>

        {/* §D45 — a set of shelves, not one value. The picker owns its own
            value through `onChange`; nothing here is a registered field, which
            is what keeps it clear of the ref hazard in .claude/mistakes.md. */}
        <Field label={t("field.categories")} error={errors.categories} htmlFor="book-categories">
          <CategoryPicker
            chipsInside
            inputId="book-categories"
            ariaLabel={t("field.categories")}
            value={watch("categories")}
            className={INPUT}
            onChange={(categories) => setValue("categories", categories, { shouldDirty: true })}
          />
        </Field>
      </div>
    </div>
  );
}
