import { HttpStatus, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  OL_EDITION_KEY_PATTERN,
  normalizeIsbn,
  type BookSuggestion,
  type OpenLibraryResult,
} from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { OPEN_LIBRARY_URL, OpenLibraryClient } from "./open-library.client";

/** Enough rows to recognise the right book in, few enough to scan. */
const SEARCH_LIMIT = 10;

/**
 * Ask for the fields we use and no others. The unfiltered search document is
 * some 60 keys wide per result, most of them arrays; naming five of them turns
 * a response measured in hundreds of kilobytes into one measured in single
 * digits, on a route that fires once per pause in typing.
 */
const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_edition_key",
].join(",");

/**
 * Open Library's search document, as much of it as we read.
 *
 * Optional almost throughout, and that is the API being described accurately
 * rather than defensively: a work with no author, no year and no resolved
 * default edition is an ordinary result, not a malformed one.
 */
const searchResponseSchema = z.object({
  docs: z
    .array(
      z.object({
        key: z.string(),
        title: z.string().optional(),
        author_name: z.array(z.string()).optional(),
        first_publish_year: z.number().int().optional(),
        cover_edition_key: z.string().optional(),
      }),
    )
    .default([]),
});

/**
 * The Books API's `jscmd=data` document, keyed by the bibkey that was asked
 * for. One request answers title, authors *by name*, page count and ISBNs.
 *
 * That last part is why this endpoint is used instead of `/books/OL…M.json`:
 * the edition document names its authors by key (`/authors/OL…A`), so filling
 * in "Frank Herbert" from it would cost a second round trip per author.
 */
const bookDataSchema = z.object({
  title: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  number_of_pages: z.number().int().optional(),
  key: z.string().optional(),
  identifiers: z
    .object({
      isbn_10: z.array(z.string()).optional(),
      isbn_13: z.array(z.string()).optional(),
    })
    .optional(),
  publishers: z.array(z.object({ name: z.string() })).optional(),
  publish_date: z.string().optional(),
  // e.g. "20 x 13 x 2 cm" — the closest this endpoint gets to a physical
  // format, and what "format" means on the form (dimensions, not binding).
  physical_dimensions: z.string().optional(),
});

/** The response is an object keyed by bibkey, empty when nothing matched. */
const booksApiResponseSchema = z.record(z.string(), bookDataSchema);

@Injectable()
export class OpenLibraryService {
  constructor(private readonly client: OpenLibraryClient) {}

  /**
   * S4.1 — works, not editions (§D7).
   *
   * The user picks the book they recognise; which edition that means is the
   * server's problem, answered by `cover_edition_key` and resolved on
   * selection by `suggestByEdition`. Results without one are still returned:
   * the title and author are usable on their own, and refusing to show a book
   * because Open Library has not decided on a default edition would be a
   * strange thing to explain.
   */
  async search(q: string): Promise<OpenLibraryResult[]> {
    const url =
      `${OPEN_LIBRARY_URL}/search.json` +
      `?q=${encodeURIComponent(q)}&fields=${SEARCH_FIELDS}&limit=${SEARCH_LIMIT}`;

    const { docs } = await this.client.json(url, searchResponseSchema);

    return docs.map((doc) => {
      const editionKey = validEditionKey(doc.cover_edition_key);

      return {
        // `/works/OL45804W` → `OL45804W`.
        workKey: doc.key.replace(/^\/works\//, ""),
        editionKey,
        title: doc.title ?? "(fără titlu)",
        // A work carries every author of every edition; the first is the one
        // the single `author` column is for.
        author: doc.author_name?.[0] ?? null,
        firstPublishYear: doc.first_publish_year ?? null,
        thumbnailUrl: thumbnailUrl(editionKey),
      };
    });
  }

  /** S4.1 — the fill that follows picking a result. */
  async suggestByEdition(editionKey: string): Promise<BookSuggestion> {
    return this.suggest(`OLID:${editionKey}`);
  }

  /**
   * S4.2 — the same fill, reached from an ISBN instead.
   *
   * The ISBN is normalised before it goes out: users type the hyphens that are
   * printed on the book, and Open Library's bibkey lookup wants the digits.
   * §D13's normaliser is the one already used to compare ISBNs locally, so
   * both ends of the app agree on what "the same ISBN" means.
   */
  async suggestByIsbn(isbn: string): Promise<BookSuggestion> {
    return this.suggest(`ISBN:${normalizeIsbn(isbn)}`);
  }

  private async suggest(bibkey: string): Promise<BookSuggestion> {
    const url =
      `${OPEN_LIBRARY_URL}/api/books` +
      `?bibkeys=${encodeURIComponent(bibkey)}&format=json&jscmd=data`;

    const response = await this.client.json(url, booksApiResponseSchema);
    const data = response[bibkey];

    // An empty object is Open Library's "no such book" — a 200, not a 404. S4.2
    // asks for a clear message and a form that stays manual, which is what a
    // 404 from here produces on the client.
    if (data === undefined) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        "OPEN_LIBRARY_NOT_FOUND",
        "error.openLibrary.bookNotFound",
      );
    }

    const olEditionKey = validEditionKey(data.key?.replace(/^\/books\//, ""));

    return {
      title: data.title ?? "",
      author: joinAuthors(data.authors),
      // ISBN-13 in preference to ISBN-10 — both identify the book, and the
      // 13-digit form is the one still being issued.
      isbn:
        data.identifiers?.isbn_13?.[0] ?? data.identifiers?.isbn_10?.[0] ?? null,
      totalPages: data.number_of_pages ?? null,
      publisher: data.publishers?.[0]?.name ?? null,
      publicationYear: publicationYear(data.publish_date),
      format: data.physical_dimensions ?? null,
      olEditionKey,
      thumbnailUrl: thumbnailUrl(olEditionKey),
    };
  }
}

/**
 * `publish_date` is free text ("1965", "August 1990", "cop. 1990") rather
 * than a structured date — the year is the only part of it worth a typed
 * field, so this pulls out the first four-digit run and drops the rest.
 */
function publicationYear(publishDate: string | undefined): number | null {
  const match = publishDate?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/**
 * Open Library's own data is not trusted to be well-formed either. Whatever
 * comes back here is interpolated into a URL that gets fetched, and later into
 * one handed to a browser; a key that does not look like an edition key is
 * dropped rather than passed along.
 */
function validEditionKey(value: string | undefined): string | null {
  return value !== undefined && OL_EDITION_KEY_PATTERN.test(value) ? value : null;
}

function thumbnailUrl(editionKey: string | null): string | null {
  return editionKey === null ? null : `/openlibrary/covers/${editionKey}`;
}

/** Any Latin letter, accented ones included — `Macció`, `Örkény`, `Ștefan`. */
const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * The authors, as one line for the single `author` column.
 *
 * Joining is right and was verified against the live API: the edition for
 * *Sandworms of Dune* really does list "Kevin J. Anderson" and "Brian
 * Herbert", and printing one of them would be quietly wrong.
 *
 * But Open Library's `authors` also carries **the same author written in
 * another script**. The edition behind ISBN 9780441013593 lists `["Frank
 * Herbert", "Френк Герберт"]`, and a plain join puts both on screen as though
 * Dune had two authors.
 *
 * There is no field distinguishing the two cases, so this leans on the one
 * signal that is actually there: a genuinely co-authored book lists its
 * authors in **one** script. If any name is Latin, the non-Latin ones are
 * transliterations of it and are dropped. A Russian edition, whose names are
 * all Cyrillic, keeps every one of them — the rule only ever fires on a mixed
 * list, which is exactly the case it is for.
 */
function joinAuthors(authors: { name: string }[] | undefined): string | null {
  const names = authors?.map((author) => author.name.trim()).filter(Boolean) ?? [];

  if (names.length === 0) {
    return null;
  }

  const latin = names.filter((name) => LATIN_LETTER.test(name));

  return (latin.length > 0 ? latin : names).join(", ");
}
