import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import { Throttle, seconds } from "@nestjs/throttler";
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  isbnLookupSchema,
  olEditionKeySchema,
  openLibrarySearchQuerySchema,
  type BookSuggestion,
  type OpenLibraryResult,
  type OpenLibrarySearchQuery,
} from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { arrayOf, ref } from "../docs/openapi";
import { OpenLibraryClient } from "./open-library.client";
import { OpenLibraryService } from "./open-library.service";

/** A day. A cover that exists does not become a different image. */
const THUMBNAIL_MAX_AGE = 60 * 60 * 24;

/**
 * Sprint 4. Every route here is a proxy, and that is the design rather than an
 * accident of layering: ARCHITECTURE.md §Open Library states that the frontend
 * never calls `openlibrary.org` itself. The rule is not stylistic — the cover
 * has to be *downloaded and stored* (§D8, §D18), which can only happen
 * server-side, and once one half of the integration lives here the other half
 * has no reason to be split off.
 *
 * Behind the global session guard like everything else. Not incidental for the
 * image route: an unauthenticated one would be an open image relay for anyone
 * who found it.
 */
@ApiTags("open-library")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă.",
  schema: ref("HttpError"),
})
@ApiServiceUnavailableResponse({
  description:
    "Open Library nu răspunde. **Nu e o eroare fatală**: criteriul de " +
    "degradare cere ca fluxul manual din Sprint 1 să rămână complet " +
    "utilizabil, deci clientul afișează mesajul și lasă formularul în pace.",
  schema: ref("HttpError"),
})
@ApiBadGatewayResponse({
  description: "Open Library a răspuns, dar cu o eroare sau cu ceva ilizibil.",
  schema: ref("HttpError"),
})
/**
 * Tighter than the app-wide limit, because these requests cost somebody else's
 * bandwidth as well as ours. A debounced search produces at most three or four
 * a second while someone types quickly; ten leaves room for that and still
 * stops a client with a broken effect loop from hammering Open Library under
 * our name.
 */
@Throttle({ short: { limit: 10, ttl: seconds(1) } })
@Controller("openlibrary")
export class OpenLibraryController {
  constructor(
    private readonly openLibrary: OpenLibraryService,
    private readonly client: OpenLibraryClient,
  ) {}

  /** S4.1. */
  @ApiOperation({
    summary: "Caută în Open Library",
    description:
      "S4.1 — caută după titlu și/sau autor și întoarce cel mult 10 " +
      "rezultate.\n\n" +
      "Rezultatele sunt **works, nu ediții** (§D7): utilizatorul recunoaște " +
      "cartea, nu ediția. `editionKey` e ediția implicită pe care Open " +
      "Library o asociază lucrării, iar `GET /openlibrary/editions/{key}` e " +
      "pasul care o transformă în câmpuri de formular.\n\n" +
      "Poate fi `null`: o lucrare fără ediție implicită n-are copertă și n-are " +
      "număr de pagini de oferit, dar titlul și autorul rămân utile, deci " +
      "rândul e returnat oricum.\n\n" +
      "**Debounce-ul de 300ms e în frontend** (S4.1) — un request per pauză de " +
      "tastare. Ruta are în plus o limită proprie de 10 cereri/secundă.",
  })
  @ApiQuery({
    name: "q",
    required: true,
    description: "Titlu, autor, sau amândouă. Minim două caractere.",
  })
  @ApiOkResponse({ schema: arrayOf("OpenLibraryResult") })
  @ApiBadRequestResponse({
    description: "Sub două caractere.",
    schema: ref("HttpError"),
  })
  @ApiTooManyRequestsResponse({
    description: "Peste 10 căutări pe secundă.",
    schema: ref("HttpError"),
  })
  @Get("search")
  search(
    @Query(new ZodValidationPipe(openLibrarySearchQuerySchema))
    query: OpenLibrarySearchQuery,
  ): Promise<OpenLibraryResult[]> {
    return this.openLibrary.search(query.q);
  }

  /** S4.1 — the second half of a selection. */
  @ApiOperation({
    summary: "Câmpurile unei ediții",
    description:
      "S4.1 / §D7 — ce se completează în formular după ce utilizatorul alege " +
      "un rezultat: titlu, autor, ISBN, număr de pagini.\n\n" +
      "Nimic nu se salvează aici. Câmpurile ajung în formular și rămân " +
      "editabile (S1.3); cartea se creează abia la `POST /books`, iar " +
      "**coperta se descarcă atunci**, nu acum — o carte căutată și " +
      "abandonată în formular nu trebuie să lase un blob în bază.",
  })
  @ApiParam({
    name: "editionKey",
    description: "Cheia ediției, ca `OL7353617M`.",
    example: "OL7353617M",
  })
  @ApiOkResponse({ schema: ref("BookSuggestion") })
  @ApiBadRequestResponse({
    description: "Cheie care nu arată a cheie de ediție Open Library.",
    schema: ref("HttpError"),
  })
  @ApiNotFoundResponse({
    description: "Open Library nu cunoaște ediția.",
    schema: ref("HttpError"),
  })
  @Get("editions/:editionKey")
  edition(
    @Param("editionKey", new ZodValidationPipe(olEditionKeySchema))
    editionKey: string,
  ): Promise<BookSuggestion> {
    return this.openLibrary.suggestByEdition(editionKey);
  }

  /** S4.2. */
  @ApiOperation({
    summary: "Câmpurile unei cărți după ISBN",
    description:
      "S4.2 — la introducerea unui ISBN se completează titlul, autorul, " +
      "numărul de pagini și coperta. Acceptă **ISBN-10 și ISBN-13**, cu sau " +
      "fără cratime: punctuația se ignoră la fel ca la verificarea de " +
      "duplicat (§D13).\n\n" +
      "**Ordinea pe câmpul ISBN e a clientului, și e stabilită:** întâi " +
      "`GET /books/isbn-duplicates` („ai deja această carte”), abia apoi ruta " +
      "asta. Avertismentul nu blochează completarea — un duplicat e legitim.\n\n" +
      "ISBN negăsit => **404 cu mesaj clar**, iar formularul rămâne complet " +
      "manual.",
  })
  @ApiParam({
    name: "isbn",
    description: "10 sau 13 cifre, punctuate oricum.",
    example: "978-0-441-01359-3",
  })
  @ApiOkResponse({ schema: ref("BookSuggestion") })
  @ApiBadRequestResponse({
    description: "Nu are 10 sau 13 cifre. Cifra de control nu se verifică.",
    schema: ref("HttpError"),
  })
  @ApiNotFoundResponse({
    description: "Open Library nu cunoaște ISBN-ul.",
    schema: ref("HttpError"),
  })
  @Get("isbn/:isbn")
  isbn(
    @Param("isbn", new ZodValidationPipe(isbnLookupSchema)) isbn: string,
  ): Promise<BookSuggestion> {
    return this.openLibrary.suggestByIsbn(isbn);
  }

  /**
   * S4.1 — the thumbnails in the results list, served from our own origin.
   *
   * This is the route that keeps "the frontend never touches Open Library"
   * literally true. Returning `covers.openlibrary.org` URLs in the search
   * response would have been less code and would have made the rule false the
   * moment anything rendered one.
   *
   * It does mean rendering a *search result* reaches Open Library, which the
   * cross-cutting criterion appears to forbid. It does not: that rule is about
   * books already in the library, which are served from the stored blob and
   * look identical offline. A live search is live by definition.
   */
  @ApiOperation({
    summary: "Miniatura unei ediții",
    description:
      "S4.1 — proxy peste `covers.openlibrary.org`, ca lista de rezultate să " +
      "nu ceară imagini direct de la Open Library.\n\n" +
      "**Nu e coperta salvată a unei cărți** — aceea e `GET /covers/{bookId}` " +
      "și vine din baza de date. Asta e imaginea din lista de căutare, pentru " +
      "o carte care încă nu există.\n\n" +
      "404 când ediția n-are copertă. Open Library ar răspunde cu un " +
      "dreptunghi gri și 200; `default=false` e ce transformă asta într-un " +
      "404 onest, ca să nu ajungă un placeholder străin în galerie.",
  })
  @ApiParam({ name: "editionKey", example: "OL7353617M" })
  @ApiProduces("image/jpeg", "image/png", "image/webp")
  @ApiOkResponse({ description: "Imaginea, cache-uită o zi." })
  @ApiNotFoundResponse({
    description: "Ediția n-are copertă.",
    schema: ref("HttpError"),
  })
  @Get("covers/:editionKey")
  async thumbnail(
    @Param("editionKey", new ZodValidationPipe(olEditionKeySchema))
    editionKey: string,
    @Res() res: Response,
  ): Promise<void> {
    const image = await this.client.image(editionKey, "S");

    if (image === null) {
      // Thrown rather than written by hand, so this 404 goes through the same
      // filter as every other error and comes out in the same shape (§D27).
      throw new AppError(
        HttpStatus.NOT_FOUND,
        "OPEN_LIBRARY_NOT_FOUND",
        "Ediția n-are copertă.",
      );
    }

    res
      .set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.byteLength),
        // Not `immutable`, unlike a stored cover: this one is Open Library's
        // to change, and a day is long enough that scrolling a results list
        // twice costs one fetch.
        "Cache-Control": `private, max-age=${THUMBNAIL_MAX_AGE}`,
      })
      .send(image.data);
  }
}
