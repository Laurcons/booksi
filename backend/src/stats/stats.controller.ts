import { Controller, Get } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuthUser, StatsByMonth, StatsOverview } from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ref } from "../docs/openapi";
import { StatsService } from "./stats.service";

/**
 * Sprints 7 and 8, read-only. Everything here is derived on request (§ „valori
 * derivate”), so there is nothing to write and no stored figure that could fall
 * out of step with the books it came from.
 */
@ApiTags("stats")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă. Toate rutele de aici o cer (S0.3).",
  schema: ref("HttpError"),
})
@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @ApiOperation({
    summary: "Cifrele generale de lectură",
    description:
      "S7.1 — cărți citite, pagini citite și rating mediu; plus " +
      "`booksReading`, a doua cifră de pe dashboard-ul S8.1.\n\n" +
      "**Un singur endpoint pentru amândouă ecranele** (S8.1): dashboard-ul " +
      "și pagina de statistici citesc de aici, altfel cele două ar ajunge " +
      "inevitabil să afișeze cifre diferite pentru aceeași bibliotecă.\n\n" +
      "`booksFinished` numără doar `FINISHED`. Abandonatele nu se numără, " +
      "dar contribuie la pagini (§D11).\n\n" +
      "`pagesRead` urmează regula unică din §D10: `FINISHED` → `totalPages` " +
      "(sau `pagesRead`, când lungimea nu e cunoscută — §D4), `READING` și " +
      "`ABANDONED` → `pagesRead`, restul → 0.\n\n" +
      "`averageRating` e media **peste cărțile care au rating**; cele fără " +
      "sunt scoase din numitor, iar o bibliotecă fără nicio notă dă `null`, " +
      "nu 0.",
  })
  @ApiOkResponse({ schema: ref("StatsOverview") })
  @Get("overview")
  overview(@CurrentUser() user: AuthUser): Promise<StatsOverview> {
    return this.stats.overview(user.id);
  }

  @ApiOperation({
    summary: "Cărți terminate pe luni",
    description:
      "S7.2 — grupare lunară pe `finishedOn`, cea mai veche lună prima.\n\n" +
      "Seria e **densă**, ca la S6.2: lunile fără nicio carte terminată apar " +
      "cu `finished: 0`, de la prima lună datată până la luna curentă. Fără " +
      "ele, graficul ar pune ianuarie lângă aprilie la lățime egală, iar axa " +
      "ar înceta să mai fie timp. O bibliotecă fără nicio carte terminată " +
      "datată întoarce o listă goală, nu o bară de zero.\n\n" +
      "Se numără **doar cărțile `FINISHED`**, aceeași populație ca la " +
      "`booksFinished`. O recitire duce cartea înapoi în `READING` fără să-i " +
      "șteargă data (S1.5), deci gruparea după dată singură ar da bare care " +
      "adunate depășesc cifra scrisă deasupra lor.\n\n" +
      "`undated` e numărul cărților terminate fără `finishedOn` — cerut " +
      "explicit de S7.2. E un **număr, nu o sumă**: ce lipsește dintr-un " +
      "grafic de cărți citite sunt cărți. Cazul e cel obișnuit, nu excepția: " +
      "o bibliotecă introdusă retroactiv intră direct în `Terminat`, iar data " +
      "se stampilează doar la tranziție.",
  })
  @ApiOkResponse({ schema: ref("StatsByMonth") })
  @Get("by-month")
  byMonth(@CurrentUser() user: AuthUser): Promise<StatsByMonth> {
    return this.stats.byMonth(user.id);
  }
}
