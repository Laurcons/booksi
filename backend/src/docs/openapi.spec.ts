import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { OpenAPIObject } from "@nestjs/swagger";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { buildOpenApiDocument, SCHEMA_NAMES } from "./openapi";

/**
 * Documentation nobody asserts on is documentation that quietly stops matching
 * the code. These tests are the guard: a route added in a later sprint without
 * an `@ApiOperation` fails the suite instead of shipping undescribed.
 */
describe("OpenAPI document", () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: "test",
              PORT: 3000,
              DATABASE_URL: "mysql://x:y@localhost:3306/z",
              GOOGLE_CLIENT_ID: "test-client-id",
              GOOGLE_CLIENT_SECRET: "test-client-secret",
              GOOGLE_CALLBACK_URL: "http://localhost:3000/auth/google/callback",
              JWT_SECRET: "test-secret-long-enough",
              WEB_ORIGIN: "http://localhost:5173",
            }),
          ],
        }),
        PrismaModule,
        AuthModule,
        BooksModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const operations = () =>
    Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, unknown>)
        .filter(([method]) =>
          ["get", "post", "patch", "put", "delete"].includes(method),
        )
        .map(([method, operation]) => ({
          id: `${method.toUpperCase()} ${path}`,
          operation: operation as {
            summary?: string;
            description?: string;
            tags?: string[];
            responses?: Record<string, unknown>;
          },
        })),
    );

  it("covers every route the app exposes", () => {
    expect(operations().map((o) => o.id).sort()).toEqual([
      "DELETE /books/{id}",
      "GET /auth/google",
      "GET /auth/google/callback",
      "GET /auth/me",
      "GET /books",
      "GET /books/isbn-duplicates",
      "GET /books/wishlist-summary",
      "GET /books/{id}",
      "GET /covers/{bookId}",
      "GET /openlibrary/covers/{editionKey}",
      "GET /openlibrary/editions/{editionKey}",
      "GET /openlibrary/isbn/{isbn}",
      "GET /openlibrary/search",
      "PATCH /books/{id}",
      "POST /auth/logout",
      "POST /books",
      "POST /books/{id}/purchase",
      "PUT /books/{id}/cover",
    ]);
  });

  it("gives every route a summary, a tag and at least one response", () => {
    for (const { id, operation } of operations()) {
      expect({ id, summary: operation.summary }).toEqual({
        id,
        summary: expect.any(String),
      });
      expect({ id, tags: operation.tags }).toEqual({
        id,
        tags: expect.arrayContaining([expect.any(String)]),
      });
      expect({ id, responses: Object.keys(operation.responses ?? {}) }).toEqual({
        id,
        responses: expect.arrayContaining([expect.any(String)]),
      });
    }
  });

  it("registers every schema derived from shared/", () => {
    for (const name of SCHEMA_NAMES) {
      expect(document.components?.schemas?.[name]).toBeDefined();
    }
  });

  it("declares 3.1, the version whose schemas are plain JSON Schema", () => {
    // zod emits draft 2020-12; only OpenAPI 3.1 takes it unaltered.
    expect(document.openapi).toBe("3.1.0");
  });

  describe("the request body is documented from the input side", () => {
    const schema = () =>
      document.components?.schemas?.CreateBookInput as {
        required?: string[];
        properties?: Record<string, unknown>;
      };

    it("requires the title and nothing else (S1.1)", () => {
      expect(schema().required).toEqual(["title"]);
    });

    it("accepts the fields Sprints 1 to 4 own", () => {
      expect(Object.keys(schema().properties ?? {}).sort()).toEqual([
        "author",
        "estimatedPrice",
        "finishedOn",
        "genre",
        "isbn",
        // S4.1 — the edition to fetch a cover for (§D8). Writable, unlike the
        // `coverUrl` it eventually produces.
        "olEditionKey",
        "pagesRead",
        "paidPrice",
        "purchasedOn",
        "rating",
        "startedOn",
        "status",
        "title",
        "totalPages",
      ]);
    });

    it("keeps fields belonging to later sprints out", () => {
      // `favorite` is a column already and is returned on read, but a request
      // that sets it is rejected — so it must not appear as writable here.
      expect(schema().properties).not.toHaveProperty("favorite");
    });

    it("carries the money constraints into the schema (S2.4, S3.2)", () => {
      // Documented rather than merely enforced: a generated client should know
      // the columns are DECIMAL(10,2) without having to POST a third decimal.
      // Both prices, because §D6 keeps them separate everywhere else too.
      for (const field of ["paidPrice", "estimatedPrice"]) {
        expect({ field, schema: schema().properties?.[field] }).toEqual({
          field,
          schema: expect.objectContaining({
            anyOf: expect.arrayContaining([
              expect.objectContaining({ multipleOf: 0.01, minimum: 0 }),
            ]),
          }),
        });
      }
    });
  });

  it("documents the response shape including the read-only columns", () => {
    const book = document.components?.schemas?.Book as {
      properties?: Record<string, unknown>;
    };

    // S1.2 asks for price and rating columns from the start, empty until
    // Sprints 2–3 — so they belong in the response even though nothing can
    // set them yet.
    expect(book.properties).toHaveProperty("rating");
    expect(book.properties).toHaveProperty("paidPrice");
    // S4.3 — where to find the cover, never the image itself (§D18).
    expect(book.properties).toHaveProperty("coverUrl");
    expect(book.properties).not.toHaveProperty("userId");
  });

  it("documents 404 — not 403 — wherever a book is addressed by id (S0.3)", () => {
    const byId: Record<string, readonly ("get" | "patch" | "delete" | "post")[]> = {
      "/books/{id}": ["get", "patch", "delete"],
      "/books/{id}/purchase": ["post"],
    };

    for (const [path, methods] of Object.entries(byId)) {
      for (const method of methods) {
        const responses = (
          document.paths[path] as Record<
            string,
            { responses?: Record<string, unknown> }
          >
        )[method].responses;

        expect({ path, method, has404: "404" in (responses ?? {}) }).toEqual({
          path,
          method,
          has404: true,
        });
        expect(responses).not.toHaveProperty("403");
      }
    }
  });

  it("describes the session cookie as the security scheme", () => {
    expect(document.components?.securitySchemes?.session).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "session",
    });
  });
});
