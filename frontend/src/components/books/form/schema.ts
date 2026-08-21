import { z } from "zod";
import {
  createBookSchema,
  isRatable,
  statusSchema,
  type Book,
  type CreateBookInput,
} from "@bookcsi/shared";

/**
 * What the book form holds, and how it becomes what the API takes.
 *
 * Lifted out of `BookFormDialog` when the dialog grew tabs: the translation
 * between an input's strings and the API's numbers, nulls and calendar days is
 * the part of that file with no JSX in it and the part most worth testing on
 * its own.
 *
 * Inputs speak strings; the API speaks numbers, nulls and calendar days. The
 * schema below is only that translation, and it ends in `createBookSchema`
 * from `shared/` — the same object the API validates with, so a rule cannot
 * drift between the two sides.
 */
export const bookFormSchema = z
  .object({
    title: z.string(),
    author: z.string(),
    isbn: z.string(),
    totalPages: z.string(),
    categories: z.array(z.string()),
    publisher: z.string(),
    publicationYear: z.string(),
    volume: z.string(),
    format: z.string(),
    description: z.string(),
    review: z.string(),
    status: statusSchema,
    pagesRead: z.string(),
    /**
     * The stars, as the radio group reports them — and `null` is one of the
     * answers it gives.
     *
     * When *every* radio in a group is disabled, react-hook-form finds none it
     * may read and reports the field as `null` rather than as `""`. That case
     * exists now and did not before: the stars are disabled on a status that
     * cannot hold a rating instead of being unmounted, so a book being read has
     * five disabled radios and a null-valued field. Rejecting it here made the
     * whole form unsavable from any tab, which is a spectacular way for a
     * validation union to fail.
     *
     * "Nobody has chosen a star" is what both `null` and `""` mean, so both are
     * accepted and the transform folds them together. What actually goes out is
     * `ratingFor`'s business, and it sends nothing at all on these statuses.
     */
    rating: z.union([z.enum(["1", "2", "3", "4", "5"]), z.literal(""), z.null()]),
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
    categories: values.categories,
    publisher: values.publisher,
    publicationYear:
      values.publicationYear.trim() === "" ? null : Number(values.publicationYear),
    volume: values.volume.trim() === "" ? null : Number(values.volume),
    format: values.format,
    // §D40 — plain text either way; `nullableText` on the API side is what
    // turns a textarea the user emptied back into a NULL column.
    description: values.description,
    // The same treatment, and deliberately *not* gated on the status the way
    // the rating below is: a review is writable whatever state the book is in
    // (see `shared/src/book.ts`), so there is nothing to decide here.
    review: values.review,
    status: values.status,
    // S2.1. Blank is 0, not null: the column has no null to store, and "I
    // haven't opened it yet" is genuinely page zero.
    pagesRead: values.pagesRead.trim() === "" ? 0 : Number(values.pagesRead),
    rating: ratingFor(values.status, values.rating ?? ""),
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

export type BookFormValues = z.input<typeof bookFormSchema>;

/**
 * Both prices, in and out of the same box. Comma is what a Romanian keyboard
 * produces for a decimal; the API wants a JSON number either way, and an empty
 * field is a price nobody has decided on rather than a zero.
 */
function toMoney(value: string): number | null {
  return value.trim() === "" ? null : Number(value.replace(",", "."));
}

/**
 * S2.3. The stars are *offered* on every status now — disabled, not hidden, on
 * the ones that cannot hold a rating — so this guard matters more than it did,
 * not less: what the form draws and what it is allowed to send have come apart.
 *
 * On any status that cannot be rated the field goes out as `undefined`
 * — *absent*, not `null`. The difference is the whole rule. `null` would clear
 * a rating the user never touched, which is exactly what the API refuses to do
 * on its own when a finished book goes back to `Citesc` for a re-read; sending
 * it from here would undo that decision from the outside.
 */
export function ratingFor(
  status: z.infer<typeof statusSchema>,
  rating: string,
): number | null | undefined {
  if (!isRatable(status)) {
    return undefined;
  }

  return rating === "" ? null : Number(rating);
}

function blankToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export const EMPTY: BookFormValues = {
  title: "",
  author: "",
  isbn: "",
  totalPages: "",
  categories: [],
  publisher: "",
  publicationYear: "",
  volume: "",
  format: "",
  description: "",
  review: "",
  status: "WISHLIST",
  pagesRead: "",
  rating: "",
  estimatedPrice: "",
  paidPrice: "",
  purchasedOn: "",
  startedOn: "",
  finishedOn: "",
};

type RatingValue = BookFormValues["rating"];

export function toFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    author: book.author ?? "",
    isbn: book.isbn ?? "",
    totalPages: book.totalPages === null ? "" : String(book.totalPages),
    categories: book.categories,
    publisher: book.publisher ?? "",
    publicationYear: book.publicationYear === null ? "" : String(book.publicationYear),
    volume: book.volume === null ? "" : String(book.volume),
    format: book.format ?? "",
    description: book.description ?? "",
    review: book.review ?? "",
    status: book.status,
    // Page zero shows as an empty box rather than a literal "0", so the field
    // reads as "nothing recorded yet" instead of as a measurement.
    pagesRead: book.pagesRead === 0 ? "" : String(book.pagesRead),
    rating: book.rating === null ? "" : (String(book.rating) as RatingValue),
    estimatedPrice: book.estimatedPrice === null ? "" : book.estimatedPrice.toFixed(2),
    paidPrice: book.paidPrice === null ? "" : book.paidPrice.toFixed(2),
    purchasedOn: book.purchasedOn ?? "",
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
  };
}

/**
 * The fields this dialog renders, which is the list both payload builders walk.
 *
 * Reading it off `EMPTY` rather than writing it twice means a field cannot be
 * added to the form and forgotten here.
 */
export type FormField = keyof BookFormValues & keyof CreateBookInput;

export const FORM_FIELDS = Object.keys(EMPTY) as FormField[];

/** The edit payload: exactly the fields the user changed, nothing else. */
export function onlyDirty(
  payload: CreateBookInput,
  // `unknown` rather than `boolean`: react-hook-form tracks a *set* field like
  // `categories` element-by-element, so its entry is a `boolean[]`, not a
  // `boolean`. Either way it is truthy once touched, which is all this reads.
  dirtyFields: Partial<Readonly<Record<keyof BookFormValues, unknown>>>,
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
export function onlyFilled(payload: CreateBookInput): CreateBookInput {
  const filled: Record<string, unknown> = {};

  for (const key of FORM_FIELDS) {
    const value = payload[key];
    // §D45 — an empty `categories` array is "no shelves", the default, so it is
    // dropped like any other empty field rather than sent as `[]`.
    const empty =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (!empty) {
      filled[key] = value;
    }
  }

  return filled as CreateBookInput;
}

/** The four tabs, in the order they are shown. */
export const TABS = ["book", "description", "reading", "verdict"] as const;

export type TabId = (typeof TABS)[number];

/**
 * Which tab each field lives on.
 *
 * Not decoration: this map is what lets the tab strip mark itself up. An unsaved
 * change or a validation error on a tab you are not looking at is invisible
 * otherwise — and an invalid field that nobody can see is a Save button that
 * appears to do nothing at all. Declared per field (rather than derived from
 * where the JSX happens to sit) so that moving a field between tabs is one
 * edit and cannot half-happen.
 */
export const TAB_OF_FIELD: Record<FormField, TabId> = {
  title: "book",
  author: "book",
  isbn: "book",
  totalPages: "book",
  categories: "book",
  publisher: "book",
  publicationYear: "book",
  volume: "book",
  format: "book",
  description: "description",
  status: "reading",
  pagesRead: "reading",
  estimatedPrice: "reading",
  paidPrice: "reading",
  purchasedOn: "reading",
  startedOn: "reading",
  finishedOn: "reading",
  rating: "verdict",
  review: "verdict",
};

/** The tabs holding at least one of the given fields, in tab order. */
export function tabsOf(fields: Iterable<string>): TabId[] {
  const hit = new Set<TabId>();

  for (const field of fields) {
    const tab = TAB_OF_FIELD[field as FormField];

    if (tab !== undefined) {
      hit.add(tab);
    }
  }

  return TABS.filter((tab) => hit.has(tab));
}

/**
 * How much prose each capped field will take, as the counter under it reports
 * it. The numbers are the API's (`shared/src/book.ts`); repeated here only so
 * the component has something to render, and asserted equal in the tests.
 */
export const DESCRIPTION_MAX = 5000;
export const REVIEW_MAX = 10_000;
