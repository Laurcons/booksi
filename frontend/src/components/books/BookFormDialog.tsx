import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createBookSchema,
  genreSchema,
  GENRE_LABEL,
  GENRE_VALUES,
  statusSchema,
  STATUS_LABEL,
  STATUS_VALUES,
  type Book,
  type CreateBookInput,
} from "@bookcsi/shared";
import { useCreateBook, useIsbnDuplicates, useUpdateBook } from "../../api/books";
import { useDebounced } from "../../lib/use-debounced";
import { Modal } from "../Modal";

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
    purchasedOn: blankToNull(values.purchasedOn),
    startedOn: blankToNull(values.startedOn),
    finishedOn: blankToNull(values.finishedOn),
  }))
  .pipe(createBookSchema);

type BookFormValues = z.input<typeof bookFormSchema>;

const EMPTY: BookFormValues = {
  title: "",
  author: "",
  isbn: "",
  totalPages: "",
  genre: "",
  status: "WISHLIST",
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
    purchasedOn: book.purchasedOn ?? "",
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
  };
}

/** The edit payload: exactly the fields the user changed, nothing else. */
function onlyDirty(
  payload: CreateBookInput,
  dirtyFields: Partial<Readonly<Record<keyof BookFormValues, boolean>>>,
): Partial<CreateBookInput> {
  const changed: Record<string, unknown> = {};

  for (const key of Object.keys(payload) as (keyof CreateBookInput)[]) {
    if (dirtyFields[key]) {
      changed[key] = payload[key];
    }
  }

  return changed;
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
