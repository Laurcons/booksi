import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  createBookSchema,
  genreSchema,
  isRatable,
  normalizeIsbn,
  statusSchema,
  STATUS_LABEL,
  STATUS_VALUES,
  type Book,
  type BookSuggestion,
  type CreateBookInput,
  type OpenLibraryResult,
} from "@bookcsi/shared";
import { BOOKS_KEY, useCreateBook, useIsbnDuplicates, useUpdateBook } from "../../api/books";
import {
  useEditionSuggestion,
  useIsbnSuggestion,
  uploadCoverImage,
} from "../../api/openlibrary";
import { errorMessage } from "../../lib/api";
import { useDebounced } from "../../lib/use-debounced";
import { Modal } from "../Modal";
import { AuthorInput } from "./AuthorInput";
import { CategoryPicker } from "./CategoryPicker";
import { CoverPicker } from "./CoverPicker";
import { CoverUpload } from "./CoverUpload";
import { OpenLibrarySearch } from "./OpenLibrarySearch";
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
    publisher: z.string(),
    publicationYear: z.string(),
    volume: z.string(),
    format: z.string(),
    status: statusSchema,
    pagesRead: z.string(),
    rating: z.union([z.enum(["1", "2", "3", "4", "5"]), z.literal("")]),
    estimatedPrice: z.string(),
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
    publisher: values.publisher,
    publicationYear:
      values.publicationYear.trim() === "" ? null : Number(values.publicationYear),
    volume: values.volume.trim() === "" ? null : Number(values.volume),
    format: values.format,
    status: values.status,
    // S2.1. Blank is 0, not null: the column has no null to store, and "I
    // haven't opened it yet" is genuinely page zero.
    pagesRead: values.pagesRead.trim() === "" ? 0 : Number(values.pagesRead),
    rating: ratingFor(values.status, values.rating),
    // S3.2 — the user's own guess; Open Library publishes no prices. A separate
    // field from what was paid, and §D6 is the reason: only the second one
    // feeds the Sprint 6 budget.
    estimatedPrice: toMoney(values.estimatedPrice),
    // S2.4.
    paidPrice: toMoney(values.paidPrice),
    purchasedOn: blankToNull(values.purchasedOn),
    startedOn: blankToNull(values.startedOn),
    finishedOn: blankToNull(values.finishedOn),
  }))
  .pipe(createBookSchema);

/**
 * Both prices, in and out of the same box. Comma is what a Romanian keyboard
 * produces for a decimal; the API wants a JSON number either way, and an empty
 * field is a price nobody has decided on rather than a zero.
 */
function toMoney(value: string): number | null {
  return value.trim() === "" ? null : Number(value.replace(",", "."));
}

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

/**
 * The fields Open Library can speak to (S4.1, S4.2). Everything else on
 * the form is the user's own — a status, a rating, what they paid — and no
 * external source has an opinion worth pouring into them.
 */
type FillableField =
  | "title"
  | "author"
  | "isbn"
  | "totalPages"
  | "publisher"
  | "publicationYear"
  | "format";

const EMPTY: BookFormValues = {
  title: "",
  author: "",
  isbn: "",
  totalPages: "",
  genre: "",
  publisher: "",
  publicationYear: "",
  volume: "",
  format: "",
  status: "WISHLIST",
  pagesRead: "",
  rating: "",
  estimatedPrice: "",
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
  const queryClient = useQueryClient();

  /**
   * A cover picked before the book exists — there's no id yet for the upload
   * route to address (see `CoverPicker`), so it travels alongside the create
   * request and goes up right after, the same way `olEditionKey` does.
   */
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<BookFormValues, unknown, CreateBookInput>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: book ? toFormValues(book) : EMPTY,
  });

  const isbn = useDebounced(watch("isbn"), 300);
  const duplicates = useIsbnDuplicates(isbn, book?.id);

  /**
   * S4.1 / §D8 — the edition a cover will be fetched from, if the book came
   * from Open Library at all.
   *
   * Held in state rather than as a form field because it is not the user's to
   * edit: there is no input that would mean anything, and it travels with the
   * create request only.
   */
  const [olEditionKey, setOlEditionKey] = useState<string | null>(null);

  const edition = useEditionSuggestion();

  /**
   * S4.2, and the ordering the story is explicit about: the ISBN lookup waits
   * for the duplicate check to come back. "Ai deja această carte" is the
   * answer that matters more, so it goes up first; the fill follows it.
   *
   * Gated on the field being *dirty* rather than on this being a new book.
   * Both readings of "when an ISBN is entered" are covered that way, and the
   * one thing neither should do is happen on open — an edit dialog that starts
   * rewriting fields the moment it appears is its own kind of wrong.
   */
  const isbnSuggestion = useIsbnSuggestion(
    isbn,
    dirtyFields.isbn === true && duplicates.isFetched,
  );

  /**
   * Which fill has already been applied. Without it the effect below runs
   * again on every render that touches the query — refetches, cache hits,
   * a window regaining focus — and each one would undo whatever the user had
   * typed since.
   */
  const applied = useRef<string | null>(null);

  /**
   * Pour a suggestion into the form.
   *
   * `overwrite` is the difference between the two ways a suggestion arrives,
   * and it is not a detail. **Picking a search result is an explicit "this
   * book"** — the fields should become that book's, including over anything
   * half-typed. **Typing an ISBN is not**: someone who has already written a
   * title and then adds the ISBN wants the gaps filled, not their own words
   * replaced. Filling blanks only is the behaviour that can never destroy what
   * the user wrote, which is why it is the one that runs unprompted.
   *
   * Memoised, and declared above the effect that uses it, because it *is* one
   * of that effect's dependencies — react-hook-form's setters are stable, so
   * this identity never changes and the effect stays keyed on the answer alone.
   */
  const fill = useCallback(
    (suggestion: BookSuggestion, { overwrite }: { overwrite: boolean }) => {
      const set = (field: FillableField, value: string) => {
        if (value === "" || (!overwrite && getValues(field).trim() !== "")) {
          return;
        }

        // `shouldDirty` is what makes the value survive an edit: `onlyDirty`
        // sends the fields the user changed, and a silently-set field is one
        // the form would drop on the way out.
        setValue(field, value, { shouldDirty: true });
      };

      set("title", suggestion.title);
      set("author", suggestion.author ?? "");
      set("isbn", suggestion.isbn ?? "");
      set(
        "totalPages",
        suggestion.totalPages === null ? "" : String(suggestion.totalPages),
      );
      set("publisher", suggestion.publisher ?? "");
      set(
        "publicationYear",
        suggestion.publicationYear === null ? "" : String(suggestion.publicationYear),
      );
      set("format", suggestion.format ?? "");
    },
    [getValues, setValue],
  );

  useEffect(() => {
    if (!isbnSuggestion.isSuccess) {
      return;
    }

    const key = normalizeIsbn(isbn);

    if (applied.current === key) {
      return;
    }

    applied.current = key;
    fill(isbnSuggestion.data, { overwrite: false });
    setOlEditionKey(isbnSuggestion.data.olEditionKey);
  }, [isbnSuggestion.isSuccess, isbnSuggestion.data, isbn, fill]);

  /** S4.1 — a chosen work, resolved into the edition its fields come from. */
  const selectResult = async (result: OpenLibraryResult) => {
    // Title and author are already known from the search row, so they land
    // immediately; the round trip is only for the ISBN and the page count.
    fill(
      {
        title: result.title,
        author: result.author,
        isbn: null,
        totalPages: null,
        publisher: null,
        publicationYear: result.firstPublishYear,
        format: null,
        olEditionKey: result.editionKey,
        thumbnailUrl: result.thumbnailUrl,
      },
      { overwrite: true },
    );
    setOlEditionKey(result.editionKey);

    if (result.editionKey === null) {
      return;
    }

    // A failure here costs the ISBN and the page count, not the selection: the
    // title and author are already in, and the rest is typeable. The
    // degradation criterion is that nothing gets stuck.
    const suggestion = await edition.mutateAsync(result.editionKey).catch(() => null);

    if (suggestion !== null) {
      fill(suggestion, { overwrite: true });
      // Prevents the ISBN just filled in from triggering S4.2's lookup for the
      // edition it came from.
      applied.current = normalizeIsbn(suggestion.isbn ?? "");
    }
  };

  // The stars appear and disappear with the status, so the form has to follow
  // the select rather than read the stored value once.
  const status = watch("status");
  const ratingValue = watch("rating");
  const ratingField = register("rating");
  const authorValue = watch("author");
  const authorField = register("author");
  const genreValue = watch("genre");
  const genreField = register("genre");

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
      // §D8: given the edition, the server downloads and stores the cover as
      // part of creating the book. Nothing else on the client knows about it.
      const created = await create.mutateAsync({
        ...onlyFilled(payload),
        ...(olEditionKey === null ? {} : { olEditionKey }),
      });

      // A manually picked file goes up once the id it needs exists — after
      // the dialog is already gone, on the same best-effort footing as the
      // Open Library fetch above: a failure here costs the cover, not the
      // book, and Edit is the way back to it.
      if (pendingCoverFile !== null) {
        void uploadCoverImage(created.id, pendingCoverFile)
          .then(() => queryClient.invalidateQueries({ queryKey: BOOKS_KEY }))
          .catch(() => {});
      }
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
        {/* S4.1 — above the fields, not in front of them. Only when adding:
            editing a book is not the moment to be offered a different one. */}
        {!editing && (
          <OpenLibrarySearch
            onSelect={(result) => void selectResult(result)}
            busy={edition.isPending}
          />
        )}

        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Titlu" error={errors.title}>
            <input {...register("title")} className={INPUT} autoComplete="off" />
          </Field>

          <Field label="Autor" error={errors.author}>
            <AuthorInput
              name={authorField.name}
              value={authorValue}
              className={INPUT}
              onChange={authorField.onChange}
              onBlur={authorField.onBlur}
              inputRef={authorField.ref}
              onSelect={(author) => setValue("author", author, { shouldDirty: true })}
            />
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

          <Field label="Categorie" error={errors.genre}>
            <CategoryPicker
              name={genreField.name}
              value={genreValue}
              clearLabel="— fără categorie —"
              className={INPUT}
              onChange={(genre) => setValue("genre", genre, { shouldDirty: true })}
              onBlur={genreField.onBlur}
              inputRef={genreField.ref}
            />
          </Field>

          <Field label="Editura" error={errors.publisher} hint="Opțional">
            <input {...register("publisher")} className={INPUT} autoComplete="off" />
          </Field>

          <Field
            label="Anul apariției"
            error={errors.publicationYear}
            hint="Opțional"
          >
            <input
              {...register("publicationYear")}
              type="number"
              min={1400}
              className={INPUT}
              inputMode="numeric"
            />
          </Field>

          <Field label="Volum" error={errors.volume} hint="Opțional">
            <input
              {...register("volume")}
              type="number"
              min={1}
              className={INPUT}
              inputMode="numeric"
            />
          </Field>

          <Field label="Format" error={errors.format} hint="ex. 13x20 cm">
            <input {...register("format")} className={INPUT} autoComplete="off" />
          </Field>

          {/* The duplicate warning comes first, and it comes first on screen
              too: S4.2's fill is the convenience, this is the answer. */}
          {duplicates.data && duplicates.data.length > 0 && (
            <DuplicateWarning titles={duplicates.data.map((d) => d.title)} />
          )}

          <IsbnLookupNote
            pending={isbnSuggestion.isFetching}
            found={isbnSuggestion.isSuccess}
            error={isbnSuggestion.error}
          />

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
              change over a book's life while the title and the ISBN do not.
              Sprint 3 puts the estimate beside the paid price rather than off
              on a wishlist-only screen: §D6's two numbers only mean anything
              next to each other. */}
          <div className="sm:col-span-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[.08em] text-ink-3">
              Progres și evaluare
            </h3>

            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Field label="Pagina la care am ajuns" error={errors.pagesRead}>
                <input
                  {...register("pagesRead")}
                  type="number"
                  min={0}
                  className={INPUT}
                  inputMode="numeric"
                />
              </Field>

              {/* S3.2 — optional, and it stays visible after the purchase: it
                  is what the paid price gets compared against. */}
              <Field
                label="Cât cred că va costa"
                error={errors.estimatedPrice}
                hint="lei"
              >
                <input
                  {...register("estimatedPrice")}
                  type="text"
                  className={INPUT}
                  inputMode="decimal"
                  autoComplete="off"
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

          {/* S4.3 while editing; a picker instead while adding, since the
              upload route addresses a book by id and this one has not got
              one yet (see `CoverPicker`). */}
          {editing ? (
            <CoverUpload book={book} />
          ) : (
            <CoverPicker
              title={watch("title")}
              file={pendingCoverFile}
              onChange={setPendingCoverFile}
            />
          )}
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

/**
 * S4.2 — what the ISBN lookup is doing, in one line under the field.
 *
 * A miss is the ordinary outcome and reads like one: most ISBNs are not in
 * Open Library, the story asks for a clear message, and the sentence says the
 * form still works rather than implying something broke. Nothing here blocks
 * anything — the same posture as the duplicate warning above it.
 *
 * There is no branching on status any more. "Not in Open Library" (404) and
 * "Open Library is down" (503) are different sentences, but the server wrote
 * both and §D27's code is what carries them here intact; this only has to
 * cover the failure that has no sentence at all.
 */
function IsbnLookupNote({
  pending,
  found,
  error,
}: {
  pending: boolean;
  found: boolean;
  error: Error | null;
}) {
  if (pending) {
    return <Note>Se caută ISBN-ul în Open Library…</Note>;
  }

  if (error !== null) {
    return (
      <Note>
        {errorMessage(
          error,
          "Open Library nu răspunde acum. Completează câmpurile manual.",
        )}
      </Note>
    );
  }

  if (found) {
    return <Note>Completat din Open Library. Corectează orice câmp.</Note>;
  }

  return null;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-xs text-ink-3 sm:col-span-2">
      {children}
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
    publisher: book.publisher ?? "",
    publicationYear: book.publicationYear === null ? "" : String(book.publicationYear),
    volume: book.volume === null ? "" : String(book.volume),
    format: book.format ?? "",
    status: book.status,
    // Page zero shows as an empty box rather than a literal "0", so the field
    // reads as "nothing recorded yet" instead of as a measurement.
    pagesRead: book.pagesRead === 0 ? "" : String(book.pagesRead),
    rating: book.rating === null ? "" : (String(book.rating) as RatingValue),
    estimatedPrice:
      book.estimatedPrice === null ? "" : book.estimatedPrice.toFixed(2),
    paidPrice: book.paidPrice === null ? "" : book.paidPrice.toFixed(2),
    purchasedOn: book.purchasedOn ?? "",
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
  };
}

type RatingValue = BookFormValues["rating"];

/**
 * The fields this dialog renders, which is the list both payload builders walk.
 *
 * Reading it off `EMPTY` rather than writing it twice means a field cannot be
 * added to the form and forgotten here. Walking *this* rather than the
 * payload's own keys is also what lets the two functions below drop a runtime
 * type guard they used to need: the API's type runs ahead of the form — Sprint
 * 2 opened `pagesRead`, `rating` and `paidPrice` for writing before there were
 * inputs for them — so `Object.keys(payload)` was a `string[]` that had to be
 * narrowed back down before it could index anything.
 */
type FormField = keyof BookFormValues & keyof CreateBookInput;

const FORM_FIELDS = Object.keys(EMPTY) as FormField[];

/** The edit payload: exactly the fields the user changed, nothing else. */
function onlyDirty(
  payload: CreateBookInput,
  dirtyFields: Partial<Readonly<Record<keyof BookFormValues, boolean>>>,
): Partial<CreateBookInput> {
  const changed: Record<string, unknown> = {};

  for (const key of FORM_FIELDS) {
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
 *
 * Deliberately *not* the same rule as `onlyDirty`. Dropping everything
 * untouched would work too — the API defaults a new book to `WISHLIST` on page
 * zero, so the row would come out identical — but a create request that names
 * the status and the page count says on the wire what the book is, instead of
 * leaving a reader to go and look up what the server would have assumed.
 */
function onlyFilled(payload: CreateBookInput): CreateBookInput {
  const filled: Record<string, unknown> = {};

  for (const key of FORM_FIELDS) {
    const value = payload[key];

    if (value !== null && value !== undefined && value !== "") {
      filled[key] = value;
    }
  }

  return filled as CreateBookInput;
}
