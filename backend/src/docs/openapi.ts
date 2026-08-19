import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { z } from "zod";
import {
  adminUserSummarySchema,
  authUserSchema,
  bookSchema,
  bookSuggestionSchema,
  budgetByMonthSchema,
  budgetSummarySchema,
  coverRefSchema,
  addChallengeBookSchema,
  approvePairingSchema,
  challengeSchema,
  challengeSummarySchema,
  consumePairingResponseSchema,
  createBookSchema,
  createChallengeSchema,
  createPairingResponseSchema,
  httpErrorSchema,
  isbnDuplicateSchema,
  openLibraryResultSchema,
  pairingStatusResponseSchema,
  settingsSchema,
  statsByMonthSchema,
  statsOverviewSchema,
  updateBookSchema,
  updateChallengeSchema,
  updateLocaleSchema,
  updateSettingsSchema,
  wishlistSummarySchema,
} from "@bookcsi/shared";

/**
 * OpenAPI generated from the zod schemas in `shared/`, not from a parallel set
 * of decorated classes.
 *
 * `@nestjs/swagger` normally reads `@ApiProperty()` off DTO classes. Writing
 * those here would mean a second definition of every DTO — the exact thing
 * `shared/` exists to prevent (ARCHITECTURE.md §Structură). The second
 * definition would not stay in sync; it never does.
 *
 * zod 4 emits JSON Schema draft 2020-12, which is what OpenAPI **3.1** accepts
 * verbatim — hence `setOpenAPIVersion("3.1.0")` below. No bridging library is
 * involved, so there is nothing to keep up to date but zod itself.
 *
 * The `io` argument is not a detail. `createBookSchema` and
 * `updateBookSchema` contain transforms — `""` becomes `null` on the way in —
 * and a transform has no output-side representation at all: asking for
 * `io: "output"` on them throws "Transforms cannot be represented in JSON
 * Schema". Request bodies must therefore be documented from the **input**
 * side, which is also the correct side: it describes what a client may send.
 *
 * The response schemas (`bookSchema`, `authUserSchema`, `isbnDuplicateSchema`,
 * `wishlistSummarySchema`) carry no transforms, so both sides are equivalent
 * for them; `"output"` is the honest label for what the API emits.
 */

/**
 * Errors are part of the contract, so they are modelled like everything else —
 * and now from `shared/`, alongside every other schema, since §D27 made the
 * error body something the client reads structurally rather than merely
 * displays.
 */

export type SchemaName =
  | "AuthUser"
  | "AdminUserSummary"
  | "Book"
  | "CreateBookInput"
  | "UpdateBookInput"
  | "IsbnDuplicate"
  | "WishlistSummary"
  | "OpenLibraryResult"
  | "BookSuggestion"
  | "CoverRef"
  | "BudgetSummary"
  | "BudgetByMonth"
  | "Settings"
  | "UpdateSettingsInput"
  | "StatsOverview"
  | "StatsByMonth"
  | "CreatePairingResponse"
  | "PairingStatusResponse"
  | "ApprovePairingInput"
  | "ConsumePairingResponse"
  | "Challenge"
  | "ChallengeSummary"
  | "CreateChallengeInput"
  | "UpdateChallengeInput"
  | "AddChallengeBookInput"
  | "UpdateLocaleInput"
  | "HttpError";

const SCHEMAS: Record<SchemaName, ComponentSchema> = {
  AuthUser: toOpenApiSchema(authUserSchema, "output"),
  AdminUserSummary: toOpenApiSchema(adminUserSummarySchema, "output"),
  Book: toOpenApiSchema(bookSchema, "output"),
  CreateBookInput: toOpenApiSchema(createBookSchema, "input"),
  UpdateBookInput: toOpenApiSchema(updateBookSchema, "input"),
  IsbnDuplicate: toOpenApiSchema(isbnDuplicateSchema, "output"),
  WishlistSummary: toOpenApiSchema(wishlistSummarySchema, "output"),
  OpenLibraryResult: toOpenApiSchema(openLibraryResultSchema, "output"),
  BookSuggestion: toOpenApiSchema(bookSuggestionSchema, "output"),
  CoverRef: toOpenApiSchema(coverRefSchema, "output"),
  // Sprint 6 — all derived on request, so the response side is the only side.
  BudgetSummary: toOpenApiSchema(budgetSummarySchema, "output"),
  BudgetByMonth: toOpenApiSchema(budgetByMonthSchema, "output"),
  Settings: toOpenApiSchema(settingsSchema, "output"),
  UpdateSettingsInput: toOpenApiSchema(updateSettingsSchema, "input"),
  // §D44 — the interface language, on `User` rather than in `Settings`.
  UpdateLocaleInput: toOpenApiSchema(updateLocaleSchema, "input"),
  // Sprints 7-8 — derived on request as well, so likewise output-only.
  StatsOverview: toOpenApiSchema(statsOverviewSchema, "output"),
  StatsByMonth: toOpenApiSchema(statsByMonthSchema, "output"),
  // §Autentificare (docs/kobo_design.md) — pairing by code. All derived or
  // validated on request, same as the rest of this block.
  CreatePairingResponse: toOpenApiSchema(createPairingResponseSchema, "output"),
  PairingStatusResponse: toOpenApiSchema(pairingStatusResponseSchema, "output"),
  ApprovePairingInput: toOpenApiSchema(approvePairingSchema, "input"),
  ConsumePairingResponse: toOpenApiSchema(consumePairingResponseSchema, "output"),
  // A curated set of books against a deadline (frontend/src/pages/ChallengePage.tsx).
  Challenge: toOpenApiSchema(challengeSchema, "output"),
  ChallengeSummary: toOpenApiSchema(challengeSummarySchema, "output"),
  CreateChallengeInput: toOpenApiSchema(createChallengeSchema, "input"),
  UpdateChallengeInput: toOpenApiSchema(updateChallengeSchema, "input"),
  AddChallengeBookInput: toOpenApiSchema(addChallengeBookSchema, "input"),
  HttpError: toOpenApiSchema(httpErrorSchema, "output"),
};

/** `ref("Book")` — usable anywhere `@ApiResponse` wants a schema. */
export function ref(name: SchemaName): { $ref: string } {
  return { $ref: `#/components/schemas/${name}` };
}

/** `arrayOf("Book")` — the list responses. */
export function arrayOf(name: SchemaName) {
  return { type: "array" as const, items: ref(name) };
}

export const DESCRIPTION = `
API-ul Bookcsi. Toate rutele în afara celor de autentificare cer o sesiune
validă, transportată într-un cookie \`session\` \`httpOnly\` (§D20).

**Izolarea datelor (S0.3):** \`userId\` se ia întotdeauna din sesiune, niciodată
dintr-un parametru. Un id de carte din biblioteca altcuiva întoarce **404, nu
403** — un 403 ar confirma că id-ul ghicit există.

**Try it out** funcționează direct dacă ești deja autentificat în aplicație:
cookie-ul pleacă odată cu cererea.
`.trim();

/**
 * Split out from `setupOpenApi` so the spec can inspect the document without
 * mounting a UI: documentation that is never asserted on rots quietly.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Bookcsi API")
    .setDescription(DESCRIPTION)
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.1.0")
    .addCookieAuth(
      "session",
      { type: "apiKey", in: "cookie", name: "session" },
      "session",
    )
    .addTag("auth", "Google OAuth și sesiunea (Sprint 0)")
    .addTag(
      "books",
      "Biblioteca: creare, listare, editare, ștergere (Sprint 1), plus " +
        "pagini citite, rating și suma plătită (Sprint 2) și wishlist-ul — " +
        "vedere filtrată, preț estimat, total și cumpărare într-un click " +
        "(Sprint 3)",
    )
    .addTag(
      "open-library",
      "Căutare, completare din ISBN și miniaturi (Sprint 4). Tot ce ține de " +
        "openlibrary.org trece pe aici: frontendul nu-l atinge niciodată direct",
    )
    .addTag(
      "covers",
      "Coperta unei cărți: descărcată la creare sau încărcată manual, " +
        "stocată în baza de date (§D8, §D18) și servită de aici (Sprint 4)",
    )
    .addTag(
      "stats",
      "Statisticile de lectură: cifrele generale și cărțile terminate pe " +
        "lună (Sprint 7), plus cifrele pe care dashboard-ul le arată la " +
        "deschidere (S8.1) — același endpoint pentru ambele ecrane",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // The generated document carries whatever Nest could infer; the schemas
  // derived from zod are merged in on top of it.
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...SCHEMAS },
  };

  return document;
}

export function setupOpenApi(app: INestApplication): void {
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: "docs-json",
    swaggerOptions: {
      // Without this the browser drops the session cookie on "Try it out",
      // and every call answers 401 for a reason that has nothing to do with
      // the API.
      withCredentials: true,
      persistAuthorization: true,
      docExpansion: "list",
    },
  });
}

/**
 * zod emits a `$schema` key that OpenAPI has no use for; everything else it
 * produces is already valid inside `components.schemas`.
 */
/**
 * `SchemaObject` is not exported from the package root and deep imports are
 * blocked by its `exports` map, so the type is read off the public
 * `OpenAPIObject` — the same place these values end up.
 */
type ComponentSchema = NonNullable<
  NonNullable<OpenAPIObject["components"]>["schemas"]
>[string];

function toOpenApiSchema(schema: z.ZodType, io: "input" | "output"): ComponentSchema {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
    io,
    // Reusable definitions would land in `$defs`, which does not exist in an
    // OpenAPI components object. Inlining keeps every schema self-contained.
    reused: "inline",
  });

  // The two types describe the same documents but not identically: JSON Schema
  // lets a subschema be the literal `false`, which OpenAPI's `SchemaObject`
  // does not model. Nothing in `shared/` produces one — no `z.never()`, no
  // `additionalProperties: false` on a strict object in draft form — so the
  // assertion is about the type definitions disagreeing, not about the values.
  return jsonSchema as ComponentSchema;
}

/** Exported for the spec that guards documentation coverage. */
export const SCHEMA_NAMES = Object.keys(SCHEMAS) as SchemaName[];
