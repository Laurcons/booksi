import { Controller, Get } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { CategoryTree } from "@bookcsi/shared";
import { ref } from "../docs/openapi";
import { CategoriesService } from "./categories.service";

/**
 * §D45 — the category taxonomy, served once for both frontends to cache.
 *
 * Behind the global `JwtAuthGuard` like everything else: the vocabulary is not
 * secret, but both surfaces that read it are authenticated apps, so a public
 * route would buy nothing. Not user-scoped — every reader gets the same tree.
 */
@ApiTags("categories")
@ApiCookieAuth("session")
@ApiUnauthorizedResponse({
  description: "Fără sesiune validă.",
  schema: ref("HttpError"),
})
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @ApiOperation({
    summary: "Arborele de categorii",
    description:
      "§D45 — grupurile (titluri, neselectabile) și categoriile (rafturile, " +
      "singurele atașabile unei cărți), în ordinea de afișare. Fiecare nod " +
      "poartă ambele etichete (ro/en), ca schimbarea de limbă să nu ceară o " +
      "reîncărcare. Vocabular controlat, se schimbă doar prin migrare — " +
      "clientul îl poate memora agresiv.",
  })
  @ApiOkResponse({ schema: arrayOfGroups() })
  @Get()
  tree(): Promise<CategoryTree> {
    return this.categories.tree();
  }
}

/**
 * `SchemaObject` is not exported from the package root (deep imports are
 * blocked by its `exports` map), so the type is read off the public
 * `OpenAPIObject`, the same way `docs/openapi.ts` does it.
 */
type ComponentSchema = NonNullable<
  NonNullable<OpenAPIObject["components"]>["schemas"]
>[string];

/** Inline schema for the tree — the DTO is not one of the registered refs. */
function arrayOfGroups(): ComponentSchema {
  const category: ComponentSchema = {
    type: "object",
    required: ["code", "labelRo", "labelEn"],
    properties: {
      code: { type: "string" },
      labelRo: { type: "string" },
      labelEn: { type: "string" },
    },
  };

  return {
    type: "array",
    items: {
      type: "object",
      required: ["code", "labelRo", "labelEn", "categories"],
      properties: {
        code: { type: "string" },
        labelRo: { type: "string" },
        labelEn: { type: "string" },
        categories: { type: "array", items: category },
      },
    },
  };
}
