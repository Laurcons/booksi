import { z } from "zod";
import { type Catalog, type Vars, translate } from "./i18n.js";
import { type Locale } from "./locale.js";

/**
 * The text this package produces, in both languages (§D44).
 *
 * Two catalogs, because they reach a reader by different routes and one of them
 * arrives twice:
 *
 * - **Validation** messages are attached to the schemas in `book.ts` and
 *   `openlibrary.ts`, which both ends parse with. The server renders them into
 *   a 400 body through `ZodValidationPipe`; the browser renders the *same*
 *   schema's messages under a form field through `zodResolver`, with no request
 *   involved. So the wording has to exist on both sides — which is why it lives
 *   here rather than in either one.
 * - **Errors** are the sentences an `AppError` carries. Server-side only, but
 *   here for the same reason the codes in `errors.ts` are: one definition, so
 *   the two ends cannot disagree about what a failure says.
 *
 * ## How a schema carries a message
 *
 * The schemas hold **keys**, not sentences: `.min(1, "validation.title.required")`.
 * A key is not a language, which is the point — a schema is constructed once at
 * module load, long before any request exists, so it cannot hold text chosen
 * per reader. `translateIssue` turns it back into words at the moment of
 * display.
 *
 * The alternative was schemas as `(locale) => schema` factories. It was
 * rejected on reach: `bookFormSchema` is handed to `zodResolver` at module
 * scope, `listBooksQuerySchema` to a pipe in a decorator, and both would have
 * had to become per-render and per-request constructions to thread a locale
 * through.
 */

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/**
 * Romanian is written out and English is typed against it, so a message added
 * to one and forgotten in the other fails the build rather than shipping as a
 * bare key. Romanian holds that role because it is the language the app was
 * written in, not because it outranks the other.
 */
const validationRo = {
  "validation.title.required": "Titlul e obligatoriu",
  "validation.year.implausible": "An de apariție implauzibil",
  "validation.year.future": "Anul de apariție nu poate fi în viitor",
  "validation.pagesRead.negative": "Paginile citite nu pot fi negative",
  "validation.rating.wholeStars": "Ratingul e în stele întregi",
  "validation.rating.range": "Ratingul e între 1 și 5 stele",
  "validation.money.negative": "Suma nu poate fi negativă",
  "validation.money.tooLarge": "Sumă prea mare",
  "validation.money.twoDecimals": "Cel mult două zecimale",
  "validation.date.shape": "Data se scrie ca AAAA-LL-ZZ",
  "validation.date.notACalendarDay": "Ziua asta nu există în calendar",
  "validation.isbn.digits": "Un ISBN are 10 sau 13 cifre",
  "validation.openLibrary.editionKey": "Cheie de ediție Open Library invalidă",
  "validation.search.tooShort": "Caută după cel puțin două caractere",
} as const;

export type ValidationKey = keyof typeof validationRo;

const validationEn: Catalog<ValidationKey> = {
  "validation.title.required": "A title is required",
  "validation.year.implausible": "That publication year is implausible",
  "validation.year.future": "The publication year cannot be in the future",
  "validation.pagesRead.negative": "Pages read cannot be negative",
  "validation.rating.wholeStars": "Ratings are in whole stars",
  "validation.rating.range": "Ratings run from 1 to 5 stars",
  "validation.money.negative": "The amount cannot be negative",
  "validation.money.tooLarge": "That amount is too large",
  "validation.money.twoDecimals": "Two decimal places at most",
  "validation.date.shape": "Write the date as YYYY-MM-DD",
  "validation.date.notACalendarDay": "That day does not exist in the calendar",
  "validation.isbn.digits": "An ISBN has 10 or 13 digits",
  "validation.openLibrary.editionKey": "Not a valid Open Library edition key",
  "validation.search.tooShort": "Search for at least two characters",
};

export const VALIDATION_MESSAGES: Record<Locale, Catalog<ValidationKey>> = {
  ro: validationRo,
  en: validationEn,
};

/**
 * One issue message, as a reader should see it.
 *
 * Everything goes through here, ours and zod's alike, and the two are told
 * apart by nothing more than a catalog lookup: our keys hit and are replaced,
 * while zod's own sentences miss and pass through untouched — already in the
 * right language, because the parse was given `zodErrorMap(locale)`. That is
 * why there is no branch here distinguishing the two, and no marker prefix on
 * the keys to make one possible. A dotted lowercase key and a sentence do not
 * collide.
 */
export function translateIssue(locale: Locale, message: string): string {
  return translate(locale, VALIDATION_MESSAGES[locale], message as ValidationKey);
}

/**
 * zod's *own* messages, in the reader's language — the other half of
 * `translateIssue`.
 *
 * Not every constraint on a schema carries a message of ours. `.max(255)` on a
 * title has none, and never needed one while there was a single language: zod
 * says "Too big: expected string to have <=255 characters", which was English
 * in a Romanian interface and therefore already a bug, just a quiet one that
 * only a 256-character title could show you. zod v4 ships translations for both
 * our languages, so the fix is to hand the parse the right one.
 *
 * **Per parse, not `z.config`.** The global configuration would be a single
 * mutable setting on a server answering concurrent requests for readers in
 * different languages — the classic shape of a bug that only appears under
 * load and never in a test. Passing the map to `safeParse` scopes it to the one
 * request that asked for it.
 *
 * An inline message of ours still wins where there is one: zod consults the map
 * only for issues that have no message already.
 */
const ZOD_ERROR_MAPS = {
  ro: z.locales.ro().localeError,
  en: z.locales.en().localeError,
} satisfies Record<Locale, unknown>;

export function zodErrorMap(locale: Locale): (typeof ZOD_ERROR_MAPS)[Locale] {
  return ZOD_ERROR_MAPS[locale];
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

const errorRo = {
  "error.internal": "Ceva n-a mers bine pe server. Încearcă din nou peste puțin.",
  "error.notFound": "Nu există.",
  "error.unauthenticated": "Sesiunea a expirat. Autentifică-te din nou.",
  "error.forbidden": "Nu ai acces la această acțiune.",
  "error.rateLimited": "Prea multe cereri într-un timp scurt. Așteaptă un moment.",

  "error.book.notFound": "Cartea asta nu există sau nu e a ta.",
  "error.books.notFound": "Una sau mai multe cărți nu există sau nu sunt ale tale.",
  "error.challenge.notFound": "Provocarea asta nu există sau nu e a ta.",
  "error.rating.wrongStatus":
    "Ratingul se poate da doar cărților terminate sau abandonate",

  "error.cover.formatUnsupported": "Fișierul nu e o imagine JPEG, PNG sau WebP.",
  "error.cover.rawBodyRequired":
    "Trimite imaginea ca body brut, cu Content-Type image/jpeg, image/png sau image/webp.",
  "error.cover.tooLarge":
    "Imaginea depășește {mb}MB. Micșoreaz-o și încearcă din nou.",

  "error.openLibrary.unavailable":
    "Open Library nu răspunde acum. Poți completa cartea manual.",
  "error.openLibrary.unusable":
    "Răspunsul de la Open Library n-a putut fi citit. Completează cartea manual.",
  "error.openLibrary.bookNotFound":
    "Open Library nu cunoaște cartea asta. Completeaz-o manual.",
  "error.openLibrary.errorResponse":
    "Open Library a răspuns cu o eroare. Completează cartea manual.",
  "error.openLibrary.noCover": "Ediția n-are copertă.",
  "error.openLibrary.coverDownloadFailed": "Coperta n-a putut fi descărcată.",

  "error.pairing.invalid":
    "Codul nu e valid sau a expirat. Ia un cod nou de pe dispozitiv.",
  "error.mcp.consentInvalid":
    "Cererea a expirat sau nu mai e validă. Reia conectarea din asistent.",
  "error.mcp.grantNotFound": "Conectorul ăsta nu există sau nu e al tău.",

  "error.impersonate.self": "Nu te poți impersona pe tine însuți.",
  "error.impersonate.notActive": "Nu ești în modul impersonare.",
} as const;

export type ErrorKey = keyof typeof errorRo;

const errorEn: Catalog<ErrorKey> = {
  "error.internal": "Something went wrong on the server. Try again in a moment.",
  "error.notFound": "Not found.",
  "error.unauthenticated": "Your session has expired. Sign in again.",
  "error.forbidden": "You do not have access to this action.",
  "error.rateLimited": "Too many requests too quickly. Wait a moment.",

  "error.book.notFound": "That book does not exist, or is not yours.",
  "error.books.notFound":
    "One or more of those books do not exist, or are not yours.",
  "error.challenge.notFound": "That challenge does not exist, or is not yours.",
  "error.rating.wrongStatus":
    "Only a book you have finished or abandoned can be rated",

  "error.cover.formatUnsupported": "That file is not a JPEG, PNG or WebP image.",
  "error.cover.rawBodyRequired":
    "Send the image as a raw body, with Content-Type image/jpeg, image/png or image/webp.",
  "error.cover.tooLarge":
    "That image is over {mb}MB. Make it smaller and try again.",

  "error.openLibrary.unavailable":
    "Open Library is not answering right now. You can fill the book in by hand.",
  "error.openLibrary.unusable":
    "Open Library's answer could not be read. Fill the book in by hand.",
  "error.openLibrary.bookNotFound":
    "Open Library does not know this book. Fill it in by hand.",
  "error.openLibrary.errorResponse":
    "Open Library answered with an error. Fill the book in by hand.",
  "error.openLibrary.noCover": "That edition has no cover.",
  "error.openLibrary.coverDownloadFailed": "That cover could not be downloaded.",

  "error.pairing.invalid":
    "That code is not valid, or has expired. Get a new one from the device.",
  "error.mcp.consentInvalid":
    "That request has expired or is no longer valid. Start the connection again from your assistant.",
  "error.mcp.grantNotFound": "That connector does not exist, or is not yours.",

  "error.impersonate.self": "You cannot impersonate yourself.",
  "error.impersonate.notActive": "You are not impersonating anyone.",
};

export const ERROR_MESSAGES: Record<Locale, Catalog<ErrorKey>> = {
  ro: errorRo,
  en: errorEn,
};

/**
 * The sentence for an `AppError`'s key, in the reader's language.
 *
 * `vars` exists for the one message that names a number it cannot know in
 * advance — the cover-size limit, which comes from configuration — and is
 * available to any other that grows the same need.
 */
export function errorMessageFor(
  locale: Locale,
  key: ErrorKey,
  vars?: Vars,
): string {
  return translate(locale, ERROR_MESSAGES[locale], key, vars);
}
