import { Controller, Get } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuthUser, BudgetByMonth, BudgetSummary } from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ref } from "../docs/openapi";
import { BudgetService } from "./budget.service";

/**
 * Sprint 6, read-only. Everything here is derived on request (§ „valori
 * derivate”), so there is nothing to write and no route that could get the
 * stored total and the real one out of step.
 */
@ApiTags("budget")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("budget")
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @ApiOperation({
    summary: "Totalul cheltuit și bugetul lunii",
    description:
      "S6.1 — `total` e suma tuturor valorilor `paidPrice` din bibliotecă. " +
      "Prețurile estimate din wishlist (§D6) nu intră niciodată aici.\n\n" +
      "S6.3 — `month` descrie luna curentă: cât s-a cheltuit în ea, bugetul " +
      "setat (`null` dacă nu există) și cât a mai rămas. **Restul nu se " +
      "reportează** (§D9): fiecare lună pornește de la bugetul complet. " +
      "`remaining` devine negativ la depășire — semnul e exact semnalul cerut " +
      "de S6.3, iar depășirea nu blochează nimic.\n\n" +
      "`undated` sunt cărțile cu preț plătit, dar fără `purchasedOn`: intră " +
      "în `total`, nu intră în nicio lună. Nu e un caz rar — o bibliotecă " +
      "introdusă retroactiv ajunge direct în `Terminat`, iar data de cumpărare " +
      "se stampilează doar la tranziția în `Cumpărat` (S1.5).",
  })
  @ApiOkResponse({ schema: ref("BudgetSummary") })
  @Get("summary")
  summary(@CurrentUser() user: AuthUser): Promise<BudgetSummary> {
    return this.budget.summary(user.id);
  }

  @ApiOperation({
    summary: "Cheltuielile pe luni",
    description:
      "S6.2 — grupare lunară pe `purchasedOn`, cea mai veche lună prima.\n\n" +
      "Seria e **densă**: lunile fără cumpărături apar cu `spent: 0`, de la " +
      "prima cumpărare datată până la luna curentă. Fără ele, graficul ar " +
      "pune ianuarie lângă aprilie la lățime egală, iar axa ar înceta să mai " +
      "fie timp. O bibliotecă fără nicio cumpărare datată întoarce o listă " +
      "goală, nu o bară de zero.\n\n" +
      "`undated` e aceeași cifră ca la `/budget/summary`, fiindcă e aceeași " +
      "întrebare: câte cărți nu poate arăta graficul, și ce sumă înseamnă.",
  })
  @ApiOkResponse({ schema: ref("BudgetByMonth") })
  @Get("by-month")
  byMonth(@CurrentUser() user: AuthUser): Promise<BudgetByMonth> {
    return this.budget.byMonth(user.id);
  }
}
