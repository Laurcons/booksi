import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  addChallengeBookSchema,
  createChallengeSchema,
  updateChallengeSchema,
  type AddChallengeBookInput,
  type AuthUser,
  type Challenge,
  type ChallengeSummary,
  type CreateChallengeInput,
  type UpdateChallengeInput,
} from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { arrayOf, ref } from "../docs/openapi";
import { ChallengesService } from "./challenges.service";

/**
 * Same shape as `BooksController`: the whole controller sits behind the
 * global `JwtAuthGuard`, and `userId` only ever comes from the session
 * (S0.3) — never a route or body parameter.
 */
@ApiTags("challenges")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("challenges")
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @ApiOperation({
    summary: "Listează provocările",
    description:
      "Forma de listă: câmpurile provocării plus `bookCount`/`finishedCount`, " +
      "nu array-ul complet de cărți — o listă de multe provocări nu trebuie să " +
      "care fiecare carte membră în întregime. `GET /challenges/{id}` e unde " +
      "stau cărțile complete.",
  })
  @ApiOkResponse({ schema: arrayOf("ChallengeSummary") })
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ChallengeSummary[]> {
    return this.challenges.list(user.id);
  }

  @ApiOperation({
    summary: "O singură provocare, cu cărțile ei",
    description:
      "Cărțile vin ca rânduri complete (`Book[]`), nu doar id-uri — raftul și " +
      "lista din pagina provocării se randează direct din răspuns, fără o a " +
      "doua cerere per carte.",
  })
  @ApiParam({ name: "id", description: "Id-ul provocării (cuid)." })
  @ApiOkResponse({ schema: ref("Challenge") })
  @ApiNotFoundResponse({
    description: "Nu există sau e a altcuiva.",
    schema: ref("HttpError"),
  })
  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Challenge> {
    return this.challenges.findOne(user.id, id);
  }

  @ApiOperation({
    summary: "Creează o provocare",
    description:
      "Doar titlul și termenul sunt obligatorii. `bookIds` e opțional — o " +
      "provocare poate porni goală și primi cărți ulterior prin " +
      "`POST /challenges/{id}/books`. Dacă un id din `bookIds` nu există sau " +
      "nu e al utilizatorului, cererea eșuează în întregime — nu se creează " +
      "o provocare cu mai puține cărți decât s-a cerut.",
  })
  @ApiBody({ schema: ref("CreateChallengeInput") })
  @ApiCreatedResponse({ schema: ref("Challenge") })
  @AuditAction("challenge.create")
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createChallengeSchema)) input: CreateChallengeInput,
  ): Promise<Challenge> {
    return this.challenges.create(user.id, input);
  }

  @ApiOperation({
    summary: "Modifică o provocare",
    description:
      "Titlul, descrierea și termenul — oricând, oricare. Apartenența " +
      "cărților nu e aici: vezi rutele dedicate de mai jos, aceeași convenție " +
      "ca `POST /books/{id}/purchase` față de `PATCH /books/{id}`.",
  })
  @ApiParam({ name: "id", description: "Id-ul provocării (cuid)." })
  @ApiBody({ schema: ref("UpdateChallengeInput") })
  @ApiOkResponse({ schema: ref("Challenge") })
  @ApiNotFoundResponse({
    description: "Nu există sau e a altcuiva.",
    schema: ref("HttpError"),
  })
  @AuditAction("challenge.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateChallengeSchema)) input: UpdateChallengeInput,
  ): Promise<Challenge> {
    return this.challenges.update(user.id, id, input);
  }

  @ApiOperation({
    summary: "Șterge o provocare",
    description:
      "Definitiv, fără soft-delete — la fel ca `DELETE /books/{id}`. Cărțile " +
      "însele nu se ating, doar apartenența lor la această provocare.",
  })
  @ApiParam({ name: "id", description: "Id-ul provocării (cuid)." })
  @ApiNoContentResponse({ description: "Ștearsă." })
  @ApiNotFoundResponse({
    description: "Nu există sau e a altcuiva.",
    schema: ref("HttpError"),
  })
  @AuditAction("challenge.delete")
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.challenges.remove(user.id, id);
  }

  @ApiOperation({
    summary: "Adaugă o carte la provocare",
    description:
      "Idempotentă: dacă cartea e deja pe listă, cererea nu eșuează — " +
      "rezultatul e același, provocarea o conține o singură dată.",
  })
  @ApiParam({ name: "id", description: "Id-ul provocării (cuid)." })
  @ApiBody({ schema: ref("AddChallengeBookInput") })
  @ApiOkResponse({ schema: ref("Challenge") })
  @ApiNotFoundResponse({
    description: "Provocarea sau cartea nu există ori nu sunt ale utilizatorului.",
    schema: ref("HttpError"),
  })
  @AuditAction("challenge.addBook")
  @Post(":id/books")
  @HttpCode(HttpStatus.OK)
  addBook(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addChallengeBookSchema)) input: AddChallengeBookInput,
  ): Promise<Challenge> {
    return this.challenges.addBook(user.id, id, input.bookId);
  }

  @ApiOperation({
    summary: "Scoate o carte din provocare",
    description:
      "Idempotentă și în celălalt sens: o carte care nu e pe listă lasă " +
      "provocarea neschimbată, nu întoarce 404. Cartea însăși nu se șterge — " +
      "doar apartenența ei la această provocare.",
  })
  @ApiParam({ name: "id", description: "Id-ul provocării (cuid)." })
  @ApiParam({ name: "bookId", description: "Id-ul cărții de scos." })
  @ApiOkResponse({ schema: ref("Challenge") })
  @ApiNotFoundResponse({
    description: "Provocarea nu există sau nu e a utilizatorului.",
    schema: ref("HttpError"),
  })
  @AuditAction("challenge.removeBook")
  @Delete(":id/books/:bookId")
  removeBook(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("bookId") bookId: string,
  ): Promise<Challenge> {
    return this.challenges.removeBook(user.id, id, bookId);
  }
}
