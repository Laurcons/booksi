import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createBookSchema,
  genreSchema,
  GENRE_LABEL,
  GENRE_VALUES,
  isRatable,
  statusSchema,
  STATUS_LABEL,
  STATUS_VALUES,
  type Book,
  type CreateBookInput,
} from "@bookcsi/shared";
import { useCreateBook, useIsbnDuplicates, useUpdateBook } from "../../api/books";
import { useDebounced } from "../../lib/use-debounced";
import { Modal } from "../Modal";
import { StarRatingInput } from "./StarRating";

/**
 * S1.1 (add) and S1.3 (edit) are the same form: every field is editable at any
 * time, whatever populated it. The manual form is permanent — Sprint 4 adds
 * Open Library beside it, never in place of it.
 *
 * Inputs speak strings; the API speaks numbers, nulls and calendar days. The
 * schema below is only that translation, and it ends in `createBookSchema`
 * from `shared/` — the same object the API validates with, so a rule cannot
 * drift between the two sides.
 */
const bookFormSchema = z
  .object({
    title: z.string(),
    author: z.string(),
    isbn: z.string(),
    totalPages: z.string(),
    genre: z.union([genreSchema, z.literal("")]),
    status: statusSchema,
    pagesRead: z.string(),
    rating: z.union([z.enum(["1", "2", "3", "4", "5"]), z.literal("")]),
    paidPrice: z.string(),
    purchasedOn: z.string(),
    startedOn: z.string(),
    finishedOn: z.string(),
  })
  // The annotation is load-bearing: `.pipe` matches the two types exactly, so
  // the transform has to declare that it produces the API schema's *input*.
  .transform((values): z.input<typeof createBookSchema> => ({
    title: values.title,
    author: values.author,
    isbn: values.isbn,
    totalPages: values.totalPages.trim() === "" ? null : Number(values.totalPages),
    genre: values.genre === "" ? null : values.genre,
    status: values.status,
    // S2.1. Blank is 0, not null: the column has no null to store, and "I
    // haven't opened it yet" is genuinely page zero.
    pagesRead: values.pagesRead.trim() === "" ? 0 : Number(values.pagesRead),
    rating: ratingFor(values.status, values.rating),
    // S2.4. Comma is what a Romanian keyboard produces for a decimal; the API
    // wants a JSON number either way.
    paidPrice:
      values.paidPrice.trim() === ""
        ? null
        : Number(values.paidPrice.replace(",", ".")),
    purchasedOn: blankToNull(values.purchasedOn),
    startedOn: blankToNull(values.startedOn),
    finishedOn: blankToNull(values.finishedOn),
  }))
  .pipe(createBookSchema);

/**
 * S2.3. The stars are only offered on a status that can hold a rating, so on
 * any other status the field must go out as `undefined` — *absent*, not `null`.
 *
 * The difference is the whole rule. `null` would clear a rating the user never
 * touched, which is exactly what the API refuses to do on its own when a
 * finished book goes back to `Citesc` for a re-read; sending it from here would
 * undo that decision from the outside.
 */
function ratingFor(
  status: z.infer<typeof statusSchema>,
  rating: string,
): number | null | undefined {
  if (!isRatable(status)) {
    return undefined;
  }

  return rating === "" ? null : Number(rating);
}

type BookFormValues = z.input<typeof bookFormSchema>;

const EMPTY: BookFormValues = {
  title: "",
  author: "",
  isbn: "",
  totalPages: "",
  genre: "",
  status: "WISHLIST",
  pagesRead: "",
  rating: "",
  paidPrice: "",
  purchasedOn: "",
  startedOn: "",
  finishedOn: "",
};

export function BookFormDialog({
  book,
  onClose,
}: {
  /** Absent when adding (S1.1), present when editing (S1.3). */
  book?: Book;
  onClose: () => void;
}) {
  const create = useCreateBook();
  const update = useUpdateBook();
  const editing = book !== undefined;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<BookFormValues, unknown, CreateBookInput>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: book ? toFormValues(book) : EMPTY,
  });

  const isbn = useDebounced(watch("isbn"), 300);
  const duplicates = useIsbnDuplicates(isbn, book?.id);

  // The stars appear and disappear with the status, so the form has to follow
  // the select rather than read the stored value once.
  const status = watch("status");
  const ratingValue = watch("rating");
  const ratingField = register("rating");

  const submit = handleSubmit(async (payload) => {
    if (editing) {
      // Only what the user actually touched. Sending an untouched empty date
      // would read as "clear it", and would stop the API from stamping the
      // transition date this very request just triggered (S1.5).
      const changed = onlyDirty(payload, dirtyFields);

      if (Object.keys(changed).length > 0) {
        await update.mutateAsync({ id: book.id, input: changed });
      }
    } else {
      await create.mutateAsync(onlyFilled(payload));
    }

    onClose();
  });

  const failure = create.error ?? update.error;

  return (
    <Modal
      wide
      title={editing ? "Editează cartea" : "Adaugă o carte"}
      description={
        editing
          ? "Orice câmp e editabil, indiferent de unde a venit."
          : "Doar titlul e obligatoriu. Restul se poate completa oricând."
      }
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Titlu" error={errors.title}>
            <input {...register("title")} className={INPUT} autoComplete="off" />
          </Field>

          <Field label="Autor" error={errors.author}>
            <input {...register("author")} className={INPUT} autoComplete="off" />
          </Field>

          <Field label="Nr. de pagini" error={errors.totalPages} hint="Poate lipsi">
            <input
              {...register("totalPages")}
              type="number"
              min={1}
              className={INPUT}
              inputMode="numeric"
            />
          </Field>

          <Field label="ISBN" error={errors.isbn} hint="Opțional">
            <input {...register("isbn")} className={INPUT} autoComplete="off" />
          </Field>

          <Field label="Gen" error={errors.genre}>
            <select {...register("genre")} className={INPUT}>
              <option value="">— fără gen —</option>
              {GENRE_VALUES.map((genre) => (
                <option key={genre} value={genre}>
                  {GENRE_LABEL[genre]}
                </option>
              ))}
            </select>
          </Field>

          {duplicates.data && duplicates.data.length > 0 && (
            <DuplicateWarning titles={duplicates.data.map((d) => d.title)} />
          )}

          {/* §D12: any status, in any order — the row button only ever
              proposes the next natural step. */}
          <Field label="Status" error={errors.status}>
            <select {...register("status")} className={INPUT}>
              {STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          {/* Sprint 2 — where the book has got to, what it was worth, what it
              cost. Grouped away from the identity fields above because these
              change over a book's life while the title and the ISBN do not. */}
          <div className="sm:col-span-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
              Progres și evaluare
            </h3>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field
                label="Pagina la care am ajuns"
                error={errors.pagesRead}
                hint="S2.1"
              >
                <input
                  {...register("pagesRead")}
                  type="number"
                  min={0}
                  className={INPUT}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Cât am plătit" error={errors.paidPrice} hint="lei">
                <input
                  {...register("paidPrice")}
                  type="text"
                  className={INPUT}
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            </div>

            {/* S2.3 — offered only where a rating may live. The alternative,
                showing disabled stars everywhere, invites a click that cannot
                do anything. */}
            {isRatable(status) ? (
              <div className="mt-5">
                <span className="mb-1.5 block text-sm text-ink-2">Rating</span>
                <StarRatingInput
                  name={ratingField.name}
                  value={ratingValue}
                  onChange={ratingField.onChange}
                  onBlur={ratingField.onBlur}
                  inputRef={ratingField.ref}
                />
                {errors.rating?.message && (
                  <span className="mt-1 block text-xs text-status-abandoned">
                    {errors.rating.message}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-5 text-xs text-ink-3">
                Ratingul se dă cărților terminate sau abandonate.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
              Datele lecturii
            </h3>
            <p className="mt-1 text-xs text-ink-3">
              Se completează singure la schimbarea statusului. Corectează-le
              oricând — o carte citită în 2019 trebuie să apară în 2019.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Field label="Cumpărată" error={errors.purchasedOn}>
                <input {...register("purchasedOn")} type="date" className={INPUT} />
              </Field>
              <Field label="Începută" error={errors.startedOn}>
                <input {...register("startedOn")} type="date" className={INPUT} />
              </Field>
              <Field label="Terminată" error={errors.finishedOn}>
                <input {...register("finishedOn")} type="date" className={INPUT} />
              </Field>
            </div>
          </div>
        </div>

        {failure && (
          <p role="alert" className="px-6 pb-2 text-sm text-status-abandoned">
            Nu am putut salva: {failure.message}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className={BUTTON_QUIET}>
            Renunță
          </button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? "Se salvează…" : editing ? "Salvează" : "Adaugă"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * S1.1 / §D13. Deliberately worded as a reminder, not as a problem: a re-read
 * and a second edition are both legitimate, so nothing here blocks the save.
 */
function DuplicateWarning({ titles }: { titles: string[] }) {
  return (
    <p className="rounded-lg border border-accent-quiet bg-accent-quiet/30 px-3 py-2 text-xs text-accent sm:col-span-2">
      Ai deja {titles.map((title) => `„${title}"`).join(", ")} cu acest ISBN.
      Poți salva oricum.
    </p>
  );
}

const INPUT =
  "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent";

const BUTTON_QUIET =
  "rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink";

const BUTTON_PRIMARY =
  "rounded-lg border border-accent-quiet bg-accent-quiet/40 px-4 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet disabled:opacity-60";

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: { message?: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-ink-2">{label}</span>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </span>
      {children}
      {error?.message && (
        <span className="mt-1 block text-xs text-status-abandoned">
          {error.message}
        </span>
      )}
    </label>
  );
}

function blankToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function toFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    author: book.author ?? "",
    isbn: book.isbn ?? "",
    totalPages: book.totalPages === null ? "" : String(book.totalPages),
    genre: book.genre ?? "",
    status: book.status,
    // Page zero shows as an empty box rather than a literal "0", so the field
    // reads as "nothing recorded yet" instead of as a measurement.
    pagesRead: book.pagesRead === 0 ? "" : String(book.pagesRead),
    rating: book.rating === null ? "" : (String(book.rating) as RatingValue),
    paidPrice: book.paidPrice === null ? "" : book.paidPrice.toFixed(2),
    purchasedOn: book.purchasedOn ?? "",
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
  };
}

type RatingValue = BookFormValues["rating"];

/** The edit payload: exactly the fields the user changed, nothing else. */
function onlyDirty(
  payload: CreateBookInput,
  dirtyFields: Partial<Readonly<Record<keyof BookFormValues, boolean>>>,
): Partial<CreateBookInput> {
  const changed: Record<string, unknown> = {};

  // The payload is typed by the API, and the API runs ahead of this form:
  // Sprint 2 opened `pagesRead`, `rating` and `paidPrice` for writing before
  // there were inputs for them. The transform above emits only the fields this
  // dialog renders, so those keys never turn up at runtime — the guard is what
  // tells the compiler that, and it keeps holding as later sprints add more.
  for (const key of Object.keys(payload)) {
    if (isFormField(key) && dirtyFields[key]) {
      changed[key] = payload[key];
    }
  }

  return changed;
}

const FORM_FIELDS = Object.keys(EMPTY) as (keyof BookFormValues)[];

function isFormField(key: string): key is keyof BookFormValues {
  return (FORM_FIELDS as string[]).includes(key);
}

/**
 * The create payload drops every empty field instead of sending `null`. The
 * difference matters for the three dates: an explicit `null` tells the API the
 * user cleared the field on purpose, which would suppress the automatic stamp
 * that S1.5 asks for.
 */
function onlyFilled(payload: CreateBookInput): CreateBookInput {
  const filled: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined && value !== "") {
      filled[key] = value;
    }
  }

  return filled as CreateBookInput;
}
