import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { z } from "zod";
import { COVER_MAX_BYTES, sniffCoverMimeType, type CoverMimeType } from "@bookcsi/shared";
import { AppError } from "../common/app-error";

/** Open Library's two hosts. Metadata on one, images on the other. */
export const OPEN_LIBRARY_URL = "https://openlibrary.org";
export const OPEN_LIBRARY_COVERS_URL = "https://covers.openlibrary.org";

/**
 * Short on purpose. Every call this client makes sits between a user and a
 * form they are trying to fill in, and the fallback — type it yourself — is
 * always available. Waiting thirty seconds to be told the search failed is
 * worse than being told in five.
 */
const TIMEOUT_MS = 5_000;

/**
 * A stored image is fetched at `-L`, a search thumbnail at `-S`. Open
 * Library's sizes are letters, and these are the only two the app asks for.
 */
export type CoverSize = "S" | "L";

/**
 * The one place that talks to Open Library.
 *
 * Its real job is turning three kinds of external failure into a single
 * predictable one. The degradation criterion for Sprint 4 says an Open Library
 * outage must leave the manual flow completely usable, and "usable" starts
 * with the request ending — with a status the client can act on — rather than
 * hanging or surfacing as an unhandled 500.
 *
 * The failures are kept apart because they mean different things to whoever is
 * reading the logs: **503** for "we could not reach them", **502** for "we
 * reached them and could not use the answer". To a client both mean the same
 * thing, which is why neither is fatal to the form.
 */
@Injectable()
export class OpenLibraryClient {
  private readonly log = new Logger(OpenLibraryClient.name);

  /**
   * Fetch JSON and validate it before anybody downstream sees it.
   *
   * Parsing an external document against a schema is not ceremony here. Open
   * Library's search response is a union of optional fields in practice —
   * works without an author, without a year, without a resolved edition are
   * ordinary — and reading those off an unvalidated `any` is how a missing key
   * becomes `undefined` three layers away, in a column that says `NOT NULL`.
   */
  async json<Schema extends z.ZodType>(
    url: string,
    schema: Schema,
  ): Promise<z.infer<Schema>> {
    const response = await this.request(url);

    if (!response.ok) {
      this.log.warn(`Open Library answered ${response.status} for ${url}`);
      throw badGateway(
        "Open Library a răspuns cu o eroare. Completează cartea manual.",
      );
    }

    const parsed = schema.safeParse(await this.parseJson(response, url));

    if (!parsed.success) {
      this.log.warn(`Unreadable Open Library response for ${url}: ${parsed.error.message}`);
      throw badGateway(
        "Răspunsul de la Open Library n-a putut fi citit. Completează cartea manual.",
      );
    }

    return parsed.data;
  }

  /**
   * A cover, or `null` when the edition simply has none.
   *
   * `default=false` is what makes that distinction exist. Without it the
   * covers host answers a missing image with a blank placeholder and HTTP 200,
   * so the "no cover" case would arrive as a perfectly valid grey rectangle —
   * stored in the database, served back forever, and impossible to tell from a
   * real cover after the fact. With it, a missing cover is a 404.
   */
  async image(
    editionKey: string,
    size: CoverSize,
  ): Promise<{ data: Buffer; mimeType: CoverMimeType } | null> {
    const url = `${OPEN_LIBRARY_COVERS_URL}/b/olid/${editionKey}-${size}.jpg?default=false`;
    const response = await this.request(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      this.log.warn(`Cover fetch answered ${response.status} for ${url}`);
      throw badGateway("Coperta n-a putut fi descărcată.");
    }

    const data = Buffer.from(await response.arrayBuffer());

    // The same ceiling an upload gets. Nothing suggests Open Library serves
    // anything near it, which is the point: a cover that large means the URL
    // is not returning what we think it is, and it does not belong in a
    // LONGBLOB on that basis.
    if (data.byteLength > COVER_MAX_BYTES) {
      this.log.warn(`Cover at ${url} is ${data.byteLength} bytes; refusing it`);
      return null;
    }

    // Read off the bytes, not the URL. `.jpg` in a path is a claim about a
    // file name; what gets served back to a browser from our origin should be
    // labelled by what it actually is.
    const mimeType = sniffCoverMimeType(data);

    if (mimeType === null) {
      this.log.warn(`Cover at ${url} is not a recognisable image`);
      return null;
    }

    return { data, mimeType };
  }

  /**
   * `fetch`, with the network's failure modes named. `AbortSignal.timeout`
   * covers the case that matters most and is invisible without it: a
   * connection that is accepted and then never answers.
   */
  private async request(url: string): Promise<Response> {
    try {
      return await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Open Library asks callers to identify themselves, and a request
          // that does not is liable to be throttled as anonymous traffic.
          "User-Agent": "Bookcsi/1.0 (personal library tracker)",
          Accept: "application/json, image/*",
        },
      });
    } catch (cause) {
      this.log.warn(`Open Library unreachable at ${url}: ${String(cause)}`);
      throw AppError.openLibraryUnavailable(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Open Library nu răspunde acum. Poți completa cartea manual.",
      );
    }
  }

  private async parseJson(response: Response, url: string): Promise<unknown> {
    try {
      return await response.json();
    } catch (cause) {
      this.log.warn(`Open Library sent non-JSON for ${url}: ${String(cause)}`);
      throw badGateway(
        "Răspunsul de la Open Library n-a putut fi citit. Completează cartea manual.",
      );
    }
  }
}

/**
 * "They answered, and we could not use it." A 502 rather than a 503 so the
 * logs keep the two apart, but the same code either way (§D27): there is one
 * thing to do about both, and a client branching between them would branch to
 * the same place twice.
 */
function badGateway(message: string): AppError {
  return AppError.openLibraryUnavailable(HttpStatus.BAD_GATEWAY, message);
}
