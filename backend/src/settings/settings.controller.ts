import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  updateSettingsSchema,
  type AuthUser,
  type Settings,
  type UpdateSettingsInput,
} from "@bookcsi/shared";
import { AuditAction } from "../audit/audit-action.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ref } from "../docs/openapi";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiOperation({
    summary: "Setările contului",
    description:
      "Un singur câmp deocamdată: bugetul lunar din S6.3. `null` înseamnă " +
      "„fără buget”, starea implicită — S6.1 și S6.2 sunt utile și fără el.\n\n" +
      "Rândul se creează la prima salvare, nu la înregistrare: o primă " +
      "citire fără nimic salvat nu e o eroare, e vizita normală.",
  })
  @ApiOkResponse({ schema: ref("Settings") })
  @Get()
  read(@CurrentUser() user: AuthUser): Promise<Settings> {
    return this.settings.read(user.id);
  }

  @ApiOperation({
    summary: "Salvează setările",
    description:
      "`PUT`, nu `PATCH`: cu un singur câmp, „trimite ce s-a schimbat” și " +
      "„trimite tot” sunt aceeași cerere, iar cheia obligatorie face ca " +
      "ștergerea bugetului (`null`) să nu poată fi confundată cu omiterea " +
      "lui.\n\n" +
      "Depășirea bugetului nu blochează nimic (S6.3), deci nu există aici " +
      "nicio validare care să compare suma cu ce s-a cheltuit deja.",
  })
  @ApiBody({ schema: ref("UpdateSettingsInput") })
  @ApiOkResponse({ schema: ref("Settings") })
  @ApiBadRequestResponse({
    description:
      "Buget negativ, cu mai mult de două zecimale, sau un câmp care nu " +
      "există — inclusiv `currency` și `yearlyBudget`, coloane reale pe care " +
      "nicio poveste nu le implementează (§D31).",
    schema: ref("HttpError"),
  })
  @AuditAction("settings.update")
  @Put()
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) input: UpdateSettingsInput,
  ): Promise<Settings> {
    return this.settings.update(user.id, input);
  }
}
