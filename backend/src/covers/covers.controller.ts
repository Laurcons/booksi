import { Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { COVER_MAX_BYTES, type AuthUser, type CoverRef } from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ref } from "../docs/openapi";
import { CoversService } from "./covers.service";
import { readRawBody } from "./request-body";

/** A year, which is as long as `Cache-Control` allows anything to be cached. */
const COVER_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * S4.3 — the stored cover: served on one route, replaced on another.
 *
 * Two paths under two prefixes, so the controller declares them in full rather
 * than taking one. Reading the image is addressed by the book it belongs to
 * (`/covers/{bookId}`, the route ARCHITECTURE.md names), while replacing it is
 * an operation on the book (`/books/{id}/cover`) — the same distinction the
 * URLs make everywhere else in the API.
 */
@ApiTags("covers")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă.",
  schema: ref("HttpError"),
})
@Controller()
export class CoversController {
  constructor(private readonly covers: CoversService) {}

  @ApiOperation({
    summary: "Coperta unei cărți",
    description:
      "S4.3 / §D18 — imaginea, din baza de date. Fie descărcată de la Open " +
      "Library la creare, fie încărcată de utilizator; ruta nu face " +
      "diferența, și asta e ideea (§D8): un singur mecanism de stocare.\n\n" +
      "**Nu atinge Open Library.** O carte adăugată se afișează identic și " +
      "dacă serviciul extern e complet indisponibil — criteriul de cache din " +
      "Sprint 4.\n\n" +
      "Servită cu `immutable` pe un an. Coperta unei cărți nu se schimbă… cu " +
      "excepția unui upload, motiv pentru care URL-ul din `book.coverUrl` " +
      "poartă `?v=`: la înlocuire se schimbă versiunea, deci și URL-ul, deci " +
      "cache-ul nu mai are ce servi. Parametrul e ignorat de rută — contează " +
      "doar că e acolo.\n\n" +
      "404 dacă nu există copertă, dacă nu există cartea, sau dacă e a " +
      "altcuiva. Ca peste tot (S0.3), cele trei nu se disting.",
  })
  @ApiParam({ name: "bookId", description: "Id-ul cărții (cuid)." })
  @ApiProduces("image/jpeg", "image/png", "image/webp")
  @ApiOkResponse({ description: "Imaginea." })
  @ApiNotFoundResponse({
    description: "Fără copertă, inexistentă, sau a altcuiva.",
    schema: ref("HttpError"),
  })
  @Get("covers/:bookId")
  async serve(
    @CurrentUser() user: AuthUser,
    @Param("bookId") bookId: string,
    @Res() res: Response,
  ): Promise<void> {
    const cover = await this.covers.find(user.id, bookId);

    res
      .set({
        "Content-Type": cover.mimeType,
        "Content-Length": String(cover.data.byteLength),
        "Cache-Control": `private, max-age=${COVER_MAX_AGE}, immutable`,
        // Belt and braces for the caches that ignore `immutable`: the version
        // in the URL already changes on replacement, and so does this.
        ETag: `"${cover.version.getTime()}"`,
      })
      .send(cover.data);
  }

  @ApiOperation({
    summary: "Încarcă o copertă",
    description:
      "S4.3 — imaginea ca **body brut**, cu `Content-Type: image/jpeg`, " +
      "`image/png` sau `image/webp`. Fără multipart: se trimite un singur " +
      "fișier, deci n-are de ce să fie separat de altceva.\n\n" +
      "**Formatul se citește din primii octeți**, nu din antet. Antetul e " +
      "afirmația clientului, iar imaginea ajunge servită înapoi de pe " +
      "originea noastră cu eticheta cu care a fost stocată.\n\n" +
      `**Limita e ${Math.round(COVER_MAX_BYTES / (1024 * 1024))}MB**, ` +
      "verificată și pe `Content-Length`, și pe octeții care chiar sosesc. " +
      "Frontendul redimensionează înainte (max 1000px pe latura lungă, JPEG " +
      "q0.85, tipic sub 250KB) — dar asta e o curtoazie, nu o măsură de " +
      "securitate, și limita se aplică indiferent ce trimite clientul.\n\n" +
      "O carte are o singură copertă (§D18, relație 1:1): un upload nou o " +
      "înlocuiește pe cea veche, iar `coverUrl` din răspuns e URL-ul nou, cu " +
      "versiune schimbată. Folosește-l — cel vechi e cache-uit un an.",
  })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiConsumes("image/jpeg", "image/png", "image/webp")
  @ApiBody({
    description: "Octeții imaginii.",
    schema: { type: "string", format: "binary" },
  })
  @ApiOkResponse({ schema: ref("CoverRef") })
  @ApiBadRequestResponse({
    description: "Nu e JPEG, PNG sau WebP — judecând după conținut.",
    schema: ref("HttpError"),
  })
  @ApiPayloadTooLargeResponse({
    description: "Peste limită.",
    schema: ref("HttpError"),
  })
  @ApiNotFoundResponse({
    description: "Cartea nu există sau e a altcuiva.",
    schema: ref("HttpError"),
  })
  @AuditAction("book.coverUpload")
  @Put("books/:id/cover")
  async upload(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<CoverRef> {
    const data = await readRawBody(req, COVER_MAX_BYTES);

    return this.covers.upload(user.id, id, data);
  }
}
