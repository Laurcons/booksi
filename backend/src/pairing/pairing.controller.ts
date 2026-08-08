import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Throttle, minutes } from "@nestjs/throttler";
import {
  approvePairingSchema,
  type ApprovePairingInput,
  type AuthUser,
  type ConsumePairingResponse,
  type CreatePairingResponse,
  type PairingStatusResponse,
} from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ref } from "../docs/openapi";
import { PairingService } from "./pairing.service";

/**
 * The same reasoning as the login routes in `auth.controller.ts`: `create`
 * and `consume` are reachable with no session at all, from a device that
 * cannot rate-limit itself. A Kobo asking for a code is a person tapping a
 * link, not a loop.
 */
const PAIRING_RATE = {
  short: { ttl: 1000, limit: 5 },
  long: { ttl: minutes(1), limit: 15 },
};

@ApiTags("pairing")
@Controller("pairing")
export class PairingController {
  constructor(private readonly pairing: PairingService) {}

  @ApiOperation({
    summary: "Cere un cod de împerechere",
    description:
      "Primul pas al fluxului din §Autentificare (docs/kobo_design.md): " +
      "`kobo-frontend` cheamă asta când un dispozitiv fără sesiune ajunge pe " +
      "`/pair`. Codul expiră în 10 minute — cine cere altul înainte de asta " +
      "primește un al doilea rând, nu o reîmprospătare a primului.",
  })
  @ApiCreatedResponse({ schema: ref("CreatePairingResponse") })
  @Public()
  @Throttle(PAIRING_RATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(): Promise<CreatePairingResponse> {
    return this.pairing.create();
  }

  @ApiOperation({
    summary: "Starea unei cereri de împerechere",
    description:
      "Apelat de `kobo-frontend`, niciodată de browserul dispozitivului — nu " +
      "există JavaScript pe Kobo care să sondeze un endpoint. Fără sesiune " +
      "de cerut: identificatorul e chiar autorizarea, la fel ca un cod de " +
      "autorizare OAuth de unică folosință.",
  })
  @ApiOkResponse({ schema: ref("PairingStatusResponse") })
  @ApiBadRequestResponse({
    description: "Identificatorul nu corespunde niciunei cereri.",
    schema: ref("HttpError"),
  })
  @Public()
  @Get(":id")
  status(@Param("id") id: string): Promise<PairingStatusResponse> {
    return this.pairing.status(id);
  }

  @ApiOperation({
    summary: "Aprobă un cod de împerechere",
    description:
      "Apelat din aplicația React, dintr-o sesiune deja autentificată — " +
      "`PairKoboPage.tsx`. Contul care aprobă e contul cu care Kobo-ul se va " +
      "loga; nu există un pas separat de „alege contul”.",
  })
  @ApiCookieAuth("session")
  @ApiNoContentResponse({ description: "Codul a fost aprobat pentru contul curent." })
  @ApiBadRequestResponse({
    description: "Codul nu există, a expirat, sau a fost deja folosit.",
    schema: ref("HttpError"),
  })
  @ApiUnauthorizedResponse({
    description: "Fără sesiune validă.",
    schema: ref("HttpError"),
  })
  @Post("approve")
  @HttpCode(HttpStatus.NO_CONTENT)
  async approve(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(approvePairingSchema)) input: ApprovePairingInput,
  ): Promise<void> {
    await this.pairing.approve(input.code, user.id);
  }

  @ApiOperation({
    summary: "Consumă o cerere aprobată",
    description:
      "Ultimul pas: `kobo-frontend` cheamă asta după ce dispozitivul apasă " +
      "„Am aprobat, continuă”. Răspunsul e un token de sesiune gata de pus " +
      "în cookie — nu un `Set-Cookie`, fiindcă cererea asta e server-către-" +
      "server, nu una a browserului de pe Kobo. Cu unică folosință: un al " +
      "doilea apel pe același identificator primește `PAIRING_INVALID`.",
  })
  @ApiOkResponse({ schema: ref("ConsumePairingResponse") })
  @ApiBadRequestResponse({
    description: "Cererea nu există, nu e încă aprobată, a expirat, sau a fost deja consumată.",
    schema: ref("HttpError"),
  })
  @Public()
  @Post(":id/consume")
  @HttpCode(HttpStatus.OK)
  consume(@Param("id") id: string): Promise<ConsumePairingResponse> {
    return this.pairing.consume(id);
  }
}
