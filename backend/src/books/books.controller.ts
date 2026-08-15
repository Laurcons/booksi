import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  BOOK_SORT_VALUES,
  GENRE_VALUES,
  STATUS_VALUES,
  createBookSchema,
  isbnDuplicatesQuerySchema,
  listBooksQuerySchema,
  updateBookSchema,
  type AuthUser,
  type Book,
  type CreateBookInput,
  type IsbnDuplicate,
  type IsbnDuplicatesQuery,
  type ListBooksQuery,
  type UpdateBookInput,
  type WishlistSummary,
} from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { arrayOf, ref } from "../docs/openapi";
import { BooksService } from "./books.service";

/**
 * The whole controller sits behind the global `JwtAuthGuard` — no `@Public()`
 * anywhere — and every handler passes `user.id` down to the service, which is
 * the only place a `userId` may come from (S0.3).
 */
@ApiTags("books")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  /** S1.2. */
  @ApiOperation({
    summary: "Listează biblioteca",
    description:
      "S1.2 — tabelul complet, sortabil. Coperta nu e inclusă: e o relație " +
      "separată (§D18) și se servește prin ruta ei, ca listarea să nu care " +
      "un blob per rând.\n\n" +
      "**Wishlist-ul (S3.1)** e aceeași rută cu `status=WISHLIST`, nu o " +
      "entitate separată. Totalul care însoțește vederea se ia din " +
      "`GET /books/wishlist-summary`.\n\n" +
      "**Galeria (S5.3)** e tot aceeași rută: filtrele de status, gen și " +
      "favorite se combină cu `AND` și se aplică în SQL (§D29). Un filtru " +
      "nebifat nu trimite parametrul.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: STATUS_VALUES,
    isArray: true,
    description:
      "S3.1 filtrează pe un singur status; S5.3 acceptă mai multe, ca " +
      "parametru repetat (`?status=READING&status=FINISHED`). Absent: toată " +
      "biblioteca.",
  })
  @ApiQuery({
    name: "genre",
    required: false,
    enum: GENRE_VALUES,
    description:
      "S5.3 — o singură valoare: o carte are o singură categorie (§D17, §D39). " +
      "Absent: toate categoriile.",
  })
  @ApiQuery({
    name: "favorite",
    required: false,
    type: Boolean,
    description:
      "S5.3 — `true` pentru doar favoritele, `false` pentru restul. Absent: " +
      "fără filtru.",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: BOOK_SORT_VALUES,
    description:
      "Implicit `createdAt`. Sortarea pe `status` urmează ordinea fluxului " +
      "(wishlist → cumpărat → citesc → terminat → abandonat), nu alfabetul.\n\n" +
      "`purchasedOn` există pentru raftul din S8.2, a cărui ordine implicită e " +
      "ziua cumpărării. E singura coloană rară din listă: cărțile fără dată " +
      "ies la coadă sub `desc`, ceea ce pe raft e acceptabil, iar în tabel n-a " +
      "fost niciodată cerut.",
  })
  @ApiQuery({
    name: "order",
    required: false,
    enum: ["asc", "desc"],
    description: "Implicit `desc`.",
  })
  @ApiOkResponse({ schema: arrayOf("Book") })
  @ApiBadRequestResponse({
    description: "Coloană de sortare din afara listei permise.",
    schema: ref("HttpError"),
  })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBooksQuerySchema)) query: ListBooksQuery,
  ): Promise<Book[]> {
    return this.books.findAll(user.id, query);
  }

  /**
   * S1.1 / §D13 — answers "do you already own this?" while the ISBN is being
   * typed. Declared above `:id` because Nest matches routes in declaration
   * order, and `:id` would otherwise swallow this path.
   */
  @ApiOperation({
    summary: "Caută cărți cu același ISBN",
    description:
      "S1.1 / §D13 — un **avertisment, niciodată un blocaj**. Aceeași carte " +
      "poate exista legitim de două ori (recitire, ediție diferită), deci " +
      "salvarea nu e împiedicată de un rezultat nevid.\n\n" +
      "Comparația ignoră punctuația: `978-606-4` și `9786064` sunt același " +
      "ISBN. Valoarea rămâne stocată exact cum a tastat-o utilizatorul.",
  })
  @ApiQuery({ name: "isbn", required: true, description: "Punctuat oricum." })
  @ApiQuery({
    name: "excludeId",
    required: false,
    description:
      "Cartea aflată în editare, ca să nu se raporteze drept propriul duplicat.",
  })
  @ApiOkResponse({ schema: arrayOf("IsbnDuplicate") })
  @Get("isbn-duplicates")
  isbnDuplicates(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(isbnDuplicatesQuerySchema))
    query: IsbnDuplicatesQuery,
  ): Promise<IsbnDuplicate[]> {
    return this.books.isbnDuplicates(user.id, query);
  }

  /** S3.3 — declared above `:id` for the same reason as the route above it. */
  @ApiOperation({
    summary: "Cât ar costa tot wishlist-ul",
    description:
      "S3.3 — suma prețurilor estimate din wishlist, plus câte cărți acoperă " +
      "efectiv suma.\n\n" +
      "Cele două numere se afișează împreună: `total` e calculat **doar peste " +
      "cărțile care au preț**, așa că singur ar trece drept prețul întregii " +
      "liste. Cu `priced` și `count` alături iese exact rândul din story — " +
      "„total 340 lei — 7 din 11 cărți au preț estimat”.\n\n" +
      "Valoare derivată: se calculează la fiecare cerere, nu se stochează " +
      "niciodată (`cost_total_wishlist`, DECISIONS.md).",
  })
  @ApiOkResponse({ schema: ref("WishlistSummary") })
  @Get("wishlist-summary")
  wishlistSummary(@CurrentUser() user: AuthUser): Promise<WishlistSummary> {
    return this.books.wishlistSummary(user.id);
  }

  @ApiOperation({ summary: "O singură carte" })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiOkResponse({ schema: ref("Book") })
  @ApiNotFoundResponse({
    description:
      "Cartea nu există **sau** e din biblioteca altcuiva. Cele două cazuri " +
      "sunt indistinctibile intenționat: un 403 ar confirma că id-ul ghicit " +
      "există undeva (S0.3).",
    schema: ref("HttpError"),
  })
  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Book> {
    return this.books.findOne(user.id, id);
  }

  /** S1.1. */
  @ApiOperation({
    summary: "Adaugă o carte",
    description:
      "S1.1 — **doar titlul e obligatoriu**.\n\n" +
      "Statusul se poate seta direct la creare, nu doar printr-o tranziție " +
      "ulterioară (§D12): altfel o bibliotecă deja existentă n-ar putea fi " +
      "introdusă.\n\n" +
      "Dacă statusul implică o dată (`PURCHASED`, `READING`, `FINISHED`) și " +
      "cererea nu o trimite explicit, se completează automat cu ziua curentă " +
      "(S1.5). O dată trimisă explicit are întotdeauna prioritate.\n\n" +
      "Se pot da din start și `pagesRead` (S2.1), `rating` (S2.3), " +
      "`paidPrice` (S2.4), `estimatedPrice` (S3.2) și `favorite` (S5.2) — o " +
      "carte terminată acum trei ani se introduce dintr-o singură cerere, cu " +
      "tot cu stele.",
  })
  @ApiBody({ schema: ref("CreateBookInput") })
  @ApiCreatedResponse({ schema: ref("Book") })
  @ApiBadRequestResponse({
    description:
      "Titlu lipsă, dată care nu e `YYYY-MM-DD`, rating pe o carte care nu e " +
      "terminată sau abandonată (S2.3), sau un câmp care aparține unui sprint " +
      "viitor — respins explicit, nu ignorat în tăcere.",
    schema: ref("HttpError"),
  })
  @AuditAction("book.create")
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBookSchema)) input: CreateBookInput,
  ): Promise<Book> {
    return this.books.create(user.id, input);
  }

  /** S1.3, S1.4, S1.5 — every edit, including a status change — and S2.1–S2.4. */
  @ApiOperation({
    summary: "Modifică o carte",
    description:
      "S1.3 — orice câmp e editabil oricând. O schimbare de status (S1.4) e " +
      "o editare ca oricare alta; nu există mașină de stări, orice tranziție " +
      "e permisă în orice ordine (§D12).\n\n" +
      "**Datele de status (S1.5).** La o tranziție se stampilează ziua " +
      "curentă în câmpul corespunzător, dar numai dacă acesta e gol și " +
      "cererea nu îl trimite explicit. O dată deja înregistrată nu se " +
      "suprascrie niciodată — o recitire nu șterge când ai început prima " +
      "oară. Trimiterea explicită a valorii `null` golește câmpul.\n\n" +
      "**Progres și evaluare (Sprint 2).** `pagesRead` e ruta prin care se " +
      "notează pagina curentă (S2.1) — o singură valoare, nu un istoric " +
      "(§D3), și nelimitată de `totalPages`, care lipsește des și e uneori " +
      "greșit (§D4). Procentul de progres **nu se trimite și nu se " +
      "stochează**: se calculează la afișare (S2.2).\n\n" +
      "`rating` (S2.3) se acceptă doar dacă statusul rezultat în urma cererii " +
      "e `FINISHED` sau `ABANDONED` — abandonul primește rating prin §D11. " +
      "Aceeași cerere poate trimite statusul și ratingul deodată. Ștergerea " +
      "ratingului (`null`) e permisă întotdeauna, iar o revenire la `READING` " +
      "**nu** șterge ratingul existent.\n\n" +
      "**Prețul estimat (S3.2).** `estimatedPrice` e estimarea proprie a " +
      "utilizatorului — Open Library nu dă prețuri — și e un câmp distinct de " +
      "`paidPrice` (§D6): doar al doilea alimentează bugetul din Sprint 6. Nu " +
      "e legat de status: rămâne editabil și după cumpărare, ca să existe cu " +
      "ce compara suma plătită.\n\n" +
      "Tot pe aici se corectează, ulterior, cele trei câmpuri scrise dintr-un " +
      "click de `POST /books/{id}/purchase` (S3.4).\n\n" +
      "**Favorit (S5.2).** `favorite` e o editare ca oricare alta, fără rută " +
      "proprie (§D30), și e ortogonal statusului: se poate marca și o carte " +
      "din wishlist (§D14).\n\n" +
      "Trimite doar câmpurile schimbate: un câmp absent rămâne neatins.",
  })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiBody({ schema: ref("UpdateBookInput") })
  @ApiOkResponse({ schema: ref("Book") })
  @ApiBadRequestResponse({
    description:
      "Aceleași reguli ca la creare, plus ratingul dat unei cărți care nu " +
      "ajunge în `FINISHED` sau `ABANDONED` (S2.3).",
    schema: ref("HttpError"),
  })
  @ApiNotFoundResponse({
    description: "Inexistentă sau a altcuiva — vezi `GET /books/{id}`.",
    schema: ref("HttpError"),
  })
  @AuditAction("book.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBookSchema)) input: UpdateBookInput,
  ): Promise<Book> {
    return this.books.update(user.id, id, input);
  }

  /** S3.4. */
  @ApiOperation({
    summary: "Marchează o carte drept cumpărată",
    description:
      "S3.4 — un singur click, fără modal și fără date reintroduse: " +
      "`status → PURCHASED`, `purchasedOn → azi`, `paidPrice → " +
      "estimatedPrice`.\n\n" +
      "Rută proprie, nu un `PATCH` compus de client, fiindcă regula copierii " +
      "prețului (§D6) e a serverului.\n\n" +
      "**`purchasedOn` se suprascrie**, spre deosebire de regula generală din " +
      "S1.5 — aici utilizatorul cere explicit „am cumpărat-o”, iar ziua la " +
      "care se referă e azi. Diferența se vede doar pe o carte cumpărată, " +
      "întoarsă în wishlist și cumpărată din nou.\n\n" +
      "Dacă `estimatedPrice` lipsește, `paidPrice` rămâne neatins — acțiunea " +
      "nu se blochează. Toate trei câmpurile rămân editabile prin `PATCH`.\n\n" +
      "Idempotentă în efect: reapelarea rescrie aceleași câmpuri, doar data " +
      "devine cea de azi.",
  })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiOkResponse({ schema: ref("Book") })
  @ApiNotFoundResponse({
    description: "Inexistentă sau a altcuiva — vezi `GET /books/{id}`.",
    schema: ref("HttpError"),
  })
  @AuditAction("book.purchase")
  @Post(":id/purchase")
  @HttpCode(HttpStatus.OK)
  purchase(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<Book> {
    return this.books.purchase(user.id, id);
  }

  /** S1.3. */
  @ApiOperation({
    summary: "Șterge o carte",
    description:
      "S1.3 — definitiv, fără soft-delete. Confirmarea cerută de story e " +
      "treaba interfeței; ruta execută necondiționat. Coperta asociată se " +
      "șterge în cascadă.",
  })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiNoContentResponse({ description: "Ștearsă." })
  @ApiNotFoundResponse({
    description: "Inexistentă sau a altcuiva — vezi `GET /books/{id}`.",
    schema: ref("HttpError"),
  })
  @AuditAction("book.delete")
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.books.remove(user.id, id);
  }
}
