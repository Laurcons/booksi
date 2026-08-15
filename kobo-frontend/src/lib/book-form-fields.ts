import type { Book } from "@bookcsi/shared";
import { normalizeDateInput } from "./date-input";

/**
 * The bridge between an HTML form's strings and the JSON `createBookSchema` /
 * `updateBookSchema` expect. There is no client-side validation here on
 * purpose (§Formulare: "Validarea e a serverului") — this module only
 * reshapes what was typed into the right JSON *type*, and leaves anything it
 * cannot make sense of for the API's own message to catch.
 */
export interface BookFormValues {
  title: string;
  author: string;
  isbn: string;
  totalPages: string;
  genre: string;
  publisher: string;
  publicationYear: string;
  volume: string;
  format: string;
  status: string;
  pagesRead: string;
  rating: string;
  estimatedPrice: string;
  paidPrice: string;
  purchasedOn: string;
  startedOn: string;
  finishedOn: string;
}

const FIELD_NAMES: readonly (keyof BookFormValues)[] = [
  "title",
  "author",
  "isbn",
  "totalPages",
  "genre",
  "publisher",
  "publicationYear",
  "volume",
  "format",
  "status",
  "pagesRead",
  "rating",
  "estimatedPrice",
  "paidPrice",
  "purchasedOn",
  "startedOn",
  "finishedOn",
];

/** Pulls the fields this form owns out of an urlencoded body, defaulting anything absent to `""`. */
export function readFormValues(body: unknown): BookFormValues {
  const record = (body ?? {}) as Record<string, unknown>;
  const values = {} as BookFormValues;

  for (const name of FIELD_NAMES) {
    const value = record[name];
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/** Every field pre-filled from an existing book — the starting point for the edit page. */
export function valuesFromBook(book: Book): BookFormValues {
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
    pagesRead: String(book.pagesRead),
    rating: book.rating === null ? "" : String(book.rating),
    estimatedPrice: book.estimatedPrice === null ? "" : String(book.estimatedPrice),
    paidPrice: book.paidPrice === null ? "" : String(book.paidPrice),
    purchasedOn: book.purchasedOn ?? "",
    startedOn: book.startedOn ?? "",
    finishedOn: book.finishedOn ?? "",
  };
}

export const EMPTY_FORM_VALUES: BookFormValues = {
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

/**
 * Empty text becomes `null` — a cleared field, not an absent one.
 * Non-numeric text is passed through unchanged, on purpose: `Number("abc")`
 * is `NaN`, and `JSON.stringify(NaN)` silently becomes `null`, which would
 * turn "I mistyped this" into "clear this field" without anyone deciding
 * that. Passing the string through instead means the API's own "expected
 * number" answers for it.
 */
function coerceNullableNumber(raw: string): number | string | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

/** `pagesRead` is not nullable on the wire — the column default is 0, and a cleared field means the same thing. */
function coercePagesRead(raw: string): number | string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

function coerceNullableText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The full payload a set of form values would produce, with every nullable
 * field present (as a value or `null`) — valid for `POST /books` as it
 * stands. `buildUpdatePayload` below reduces this down to only what changed.
 */
export function buildBookPayload(values: BookFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: values.title.trim(),
    author: coerceNullableText(values.author),
    isbn: coerceNullableText(values.isbn),
    totalPages: coerceNullableNumber(values.totalPages),
    genre: coerceNullableText(values.genre),
    publisher: coerceNullableText(values.publisher),
    publicationYear: coerceNullableNumber(values.publicationYear),
    volume: coerceNullableNumber(values.volume),
    format: coerceNullableText(values.format),
    pagesRead: coercePagesRead(values.pagesRead),
    rating: coerceNullableNumber(values.rating),
    estimatedPrice: coerceNullableNumber(values.estimatedPrice),
    paidPrice: coerceNullableNumber(values.paidPrice),
    purchasedOn: normalizeDateInput(values.purchasedOn),
    startedOn: normalizeDateInput(values.startedOn),
    finishedOn: normalizeDateInput(values.finishedOn),
  };

  // Not nullable on the wire either, but always present in practice — the
  // `<select>` this comes from has no blank option. Omitted only as a
  // defensive fallback to the server's own default (WISHLIST) rather than
  // sending a value the schema would refuse.
  if (values.status.trim() !== "") {
    payload.status = values.status.trim();
  }

  return payload;
}

/**
 * `PATCH /books/{id}`'s own documented contract: "trimite doar câmpurile
 * schimbate" (send only what changed). Doing that here — not just as a
 * courtesy — is what keeps S1.5's date auto-stamping working: sending
 * `startedOn: null` on every save because the field happened to render empty
 * would tell the server "clear this" on every request, silently overriding
 * the stamp a status change to `Citesc` should have produced.
 */
export function buildUpdatePayload(
  values: BookFormValues,
  original: Book,
): Record<string, unknown> {
  const candidate = buildBookPayload(values);
  const changed: Record<string, unknown> = {};
  const originalRecord = original as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(candidate)) {
    if (value !== originalRecord[key]) {
      changed[key] = value;
    }
  }

  return changed;
}

/**
 * `ZodValidationPipe`'s messages are `"field: sentence"`, one per problem
 * (§D27's contract, unchanged for this surface). Grouped by field so each
 * renders above its own input, per §Formulare; anything that does not name a
 * field it recognises lands under `""` and is shown once, at the top.
 */
export function groupErrorsByField(messages: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const message of messages) {
    const separator = message.indexOf(": ");
    const field = separator === -1 ? "" : message.slice(0, separator);
    const text = separator === -1 ? message : message.slice(separator + 2);

    (grouped[field] ??= []).push(text);
  }

  return grouped;
}
