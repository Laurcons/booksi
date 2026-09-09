import { Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  createAuthorSchema,
  listAuthorsQuerySchema,
  updateAuthorSchema,
  type Author,
  type AuthorDetail,
  type AuthUser,
  type AuthorSuggestion,
  type CreateAuthorInput,
  type DeleteAuthorResult,
  type ListAuthorsQuery,
  type UpdateAuthorInput,
} from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ValidatedBody, ValidatedQuery } from "../common/validated";
import { arrayOf, ref } from "../docs/openapi";
import { AuthorsService } from "./authors.service";

/**
 * §D51 — autorii, ca entitate.
 *
 * Nu există ecran de administrare a autorilor și nu e o omisiune: un autor se
 * creează și se șterge din caseta „Autor” a formularului de carte, iar
 * biografia se scrie în tabul „Autor” al aceluiași formular. Rutele de aici
 * există exclusiv pentru acel control.
 *
 * Toate cer sesiune (guard global, niciun `@Public()`), iar `userId` vine
 * întotdeauna din ea (S0.3). Un id din contul altcuiva întoarce 404, nu 403.
 */
@ApiTags("authors")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("authors")
export class AuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @ApiOperation({
    summary: "Listează autorii",
    description:
      "§D51 — sursa dropdown-ului din caseta „Autor”. Ordonat alfabetic, cu " +
      "numărul de cărți al fiecăruia.\n\n" +
      "**`q` absent înseamnă toată lista**, nu o eroare și nu un răspuns gol. " +
      "Fără ecran central de autori, ștergerea unui autor la care nu mai " +
      "trimite nicio carte trebuie să fie posibilă din dropdown fără să-i " +
      "știi numele dinainte.\n\n" +
      "Căutarea nu ține cont de majuscule **și nici de diacritice** — `calin` " +
      "găsește „Călinescu”. Vine din colația bazei, ca la cărți (§D42).\n\n" +
      "**Biografia nu e inclusă**: are până la 5000 de caractere și un " +
      "dropdown n-o afișează niciodată. Se ia de pe carte sau din " +
      "`GET /authors/:id`.",
  })
  @ApiQuery({
    name: "q",
    required: false,
    type: String,
    description: "Filtrează după nume. Absent sau gol: toată lista.",
  })
  @ApiOkResponse({ schema: arrayOf("AuthorSuggestion") })
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @ValidatedQuery(listAuthorsQuerySchema) query: ListAuthorsQuery,
  ): Promise<AuthorSuggestion[]> {
    return this.authors.findAll(user.id, query);
  }

  @ApiOperation({
    summary: "Un autor, cu biografie",
    description:
      "§D51 — ruta pe care formularul o cheamă când cititorul **schimbă** " +
      "autorul cărții: biografia noului autor trebuie să apară în tab, iar " +
      "dropdown-ul n-o cară. Deschiderea formularului nu are nevoie de ea — " +
      "vine deja pe carte.",
  })
  @ApiParam({ name: "id", description: "Id-ul autorului (cuid)." })
  @ApiOkResponse({ schema: ref("Author") })
  @ApiNotFoundResponse({
    description:
      "Autorul nu există **sau** e al altcuiva — indistinctibil intenționat " +
      "(S0.3).",
    schema: ref("HttpError"),
  })
  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Author> {
    return this.authors.findOne(user.id, id);
  }

  @ApiOperation({
    summary: "Creează un autor",
    description:
      "§D51 — **singurul mod în care apare un autor**, și e un act deliberat: " +
      "un clic pe rândul „Creează autorul …” din dropdown. Scrierea unei cărți " +
      "nu creează niciodată un autor, fiindcă altfel fiecare greșeală de " +
      "tastare ar produce o persoană.\n\n" +
      "**Idempotentă după nume.** Dacă numele există deja (colația leagă " +
      "majusculele și diacriticele), întoarce autorul existent cu 201 în loc " +
      "să dea eroare: clientul oferă crearea doar când nimic nu se potrivea, " +
      "deci o coliziune aici înseamnă două taburi sau un dropdown învechit — " +
      "iar în ambele cazuri răspunsul dorit e „dă-mi autorul cu numele asta”.\n\n" +
      "Biografia **nu** se trimite aici: se scrie după ce autorul există, prin " +
      "`PATCH /authors/:id`.",
  })
  @ApiBody({ schema: ref("CreateAuthorInput") })
  @ApiCreatedResponse({ schema: ref("Author") })
  @ApiBadRequestResponse({
    description: "Nume lipsă sau peste 255 de caractere.",
    schema: ref("HttpError"),
  })
  @AuditAction("author.create")
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @ValidatedBody(createAuthorSchema) input: CreateAuthorInput,
  ): Promise<Author> {
    return this.authors.create(user.id, input);
  }

  @ApiOperation({
    summary: "Scrie biografia unui autor",
    description:
      "§D51 — biografia, și numai ea. **Numele nu se poate edita**: pe sârmă, " +
      "corectarea unei greșeli de tastare și fuziunea a două persoane sunt " +
      "aceeași cerere, iar a doua rescrie în tăcere fiecare carte care " +
      "trimitea la numele vechi. Un autor greșit se repară creând cel bun, " +
      "mutând cartea pe el și ștergându-l pe cel greșit — trei acte, fiecare " +
      "spunând ce e.\n\n" +
      "**Se aplică tuturor cărților autorului.** Formularul o scrie exact așa, " +
      "sub casetă, cu numărul de cărți: nu e un câmp al cărții deschise.",
  })
  @ApiParam({ name: "id", description: "Id-ul autorului (cuid)." })
  @ApiBody({ schema: ref("UpdateAuthorInput") })
  @ApiOkResponse({ schema: ref("AuthorDetail") })
  @ApiNotFoundResponse({
    description: "Autorul nu există sau e al altcuiva (S0.3).",
    schema: ref("HttpError"),
  })
  @ApiBadRequestResponse({
    description: "Biografie peste 5000 de caractere, sau un câmp în plus.",
    schema: ref("HttpError"),
  })
  @AuditAction("author.update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @ValidatedBody(updateAuthorSchema) input: UpdateAuthorInput,
  ): Promise<AuthorDetail> {
    return this.authors.update(user.id, id, input);
  }

  @ApiOperation({
    summary: "Șterge un autor",
    description:
      "§D51 — **cărțile rămân**, fără autor (`onDelete: SetNull`). Cascade ar " +
      "șterge cărțile, ceea ce ar fi catastrofal pentru o acțiune de " +
      "curățenie făcută dintr-un dropdown; Restrict ar face autorul de neșters " +
      "până la editarea fiecărei cărți.\n\n" +
      "Răspunsul spune **câte cărți** și-au pierdut autorul. Clientul știa deja " +
      "cifra — e cea din confirmare — dar poate fi mișcată între desenarea " +
      "dropdown-ului și clic (altă filă, un apel MCP), iar un mesaj care spune " +
      "ce **s-a întâmplat** e altceva decât un ecou al predicției.\n\n" +
      "Confirmarea din interfață apare doar când cifra e nenulă: la un autor " +
      "fără cărți nu e nimic de avertizat, deci se șterge din prima.",
  })
  @ApiParam({ name: "id", description: "Id-ul autorului (cuid)." })
  @ApiOkResponse({ schema: ref("DeleteAuthorResult") })
  @ApiNotFoundResponse({
    description: "Autorul nu există sau e al altcuiva (S0.3).",
    schema: ref("HttpError"),
  })
  @AuditAction("author.delete")
  @Delete(":id")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<DeleteAuthorResult> {
    return this.authors.remove(user.id, id);
  }
}
