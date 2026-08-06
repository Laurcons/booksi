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
} from "@bookcsi/shared";
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
      "un blob per rând.",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: BOOK_SORT_VALUES,
    description:
      "Implicit `createdAt`. Sortarea pe `status` urmează ordinea fluxului " +
      "(wishlist → cumpărat → citesc → terminat → abandonat), nu alfabetul.",
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
    schema: ref("ValidationError"),
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
      "(S1.5). O dată trimisă explicit are întotdeauna prioritate.",
  })
  @ApiBody({ schema: ref("CreateBookInput") })
  @ApiCreatedResponse({ schema: ref("Book") })
  @ApiBadRequestResponse({
    description:
      "Titlu lipsă, dată care nu e `YYYY-MM-DD`, sau un câmp care aparține " +
      "unui sprint viitor (`rating`, `paidPrice`, …) — respinse explicit, nu " +
      "ignorate în tăcere.",
    schema: ref("ValidationError"),
  })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBookSchema)) input: CreateBookInput,
  ): Promise<Book> {
    return this.books.create(user.id, input);
  }

  /** S1.3, S1.4 and S1.5 — every edit, including a status change. */
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
      "Trimite doar câmpurile schimbate: un câmp absent rămâne neatins.",
  })
  @ApiParam({ name: "id", description: "Id-ul cărții (cuid)." })
  @ApiBody({ schema: ref("UpdateBookInput") })
  @ApiOkResponse({ schema: ref("Book") })
  @ApiBadRequestResponse({ schema: ref("ValidationError") })
  @ApiNotFoundResponse({
    description: "Inexistentă sau a altcuiva — vezi `GET /books/{id}`.",
    schema: ref("HttpError"),
  })
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBookSchema)) input: UpdateBookInput,
  ): Promise<Book> {
    return this.books.update(user.id, id, input);
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
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.books.remove(user.id, id);
  }
}
