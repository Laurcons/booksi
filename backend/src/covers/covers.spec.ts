import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { COVER_MAX_BYTES } from "@bookcsi/shared";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { BooksModule } from "../books/books.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuditModule } from "../audit/audit.module";
import { AppExceptionFilter } from "../common/filters/app-exception.filter";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
  // §D44 — a real row always has one; the column is NOT NULL with a
  // default, and every account predating §D44 is Romanian.
  locale: "ro",
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);

const STORED_AT = new Date("2026-08-07T09:00:00Z");

const storedBook = {
  id: "book-1",
  userId: "user-1",
  title: "Dune",
  author: "Frank Herbert",
  isbn: null,
  totalPages: 620,
  categories: [{ categoryCode: "FICTION__GENERAL" }],
  olEditionKey: null,
  status: "WISHLIST" as const,
  favorite: false,
  pagesRead: 0,
  rating: null,
  estimatedPrice: null as Prisma.Decimal | null,
  paidPrice: null as Prisma.Decimal | null,
  purchasedOn: null,
  startedOn: null,
  finishedOn: null,
  createdAt: new Date("2026-08-07T08:00:00Z"),
  updatedAt: new Date("2026-08-07T08:00:00Z"),
  cover: null as { updatedAt: Date } | null,
};

/**
 * S4.3, and the half of S4.1 that touches the database.
 *
 * Two things are being pinned here that are easy to get wrong and silent when
 * wrong: that a book still gets created when Open Library fails (the
 * degradation criterion, applied at the one point where an external call sits
 * inside a write), and that the cover's URL changes when the image does — an
 * `immutable` header on a replaceable resource is a bug that only shows up a
 * cache-lifetime later.
 */
describe("covers (Sprint 4)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    user: { findUnique: jest.fn() },
    book: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    cover: { findFirst: jest.fn(), upsert: jest.fn() },
  };

  const fetchMock = jest.fn();

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
        AuditModule,
        AuthModule,
        // Brings `CoversModule` with it — the dependency that exists so a book
        // created from a search result arrives with its cover.
        BooksModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        // §D44 — without the filter these routes answer with `AppError`'s
        // own body, which is built in `DEFAULT_LOCALE` for the bypass case.
        // Production always has it, and it is what puts the message in the
        // reader's language, so a test without it is asserting a shape
        // nobody receives.
        { provide: APP_FILTER, useClass: AppExceptionFilter },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    authService = app.get(AuthService);

    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(storedUser);
    prisma.cover.upsert.mockResolvedValue({ updatedAt: STORED_AT });
  });

  const session = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  const as = (method: "get" | "put" | "post", url: string) =>
    request(app.getHttpServer())[method](url).set("Cookie", session());

  const upload = (bytes: Buffer, contentType = "image/png") =>
    as("put", "/books/book-1/cover")
      .set("Content-Type", contentType)
      .send(bytes);

  describe("GET /covers/:bookId", () => {
    it("serves the stored image", async () => {
      prisma.cover.findFirst.mockResolvedValue({
        data: PNG,
        mimeType: "image/png",
        updatedAt: STORED_AT,
      });

      const res = await as("get", "/covers/book-1").expect(200);

      expect(res.headers["content-type"]).toBe("image/png");
      expect(Buffer.from(res.body)).toEqual(PNG);
    });

    it("never asks Open Library for it", async () => {
      prisma.cover.findFirst.mockResolvedValue({
        data: PNG,
        mimeType: "image/png",
        updatedAt: STORED_AT,
      });

      await as("get", "/covers/book-1").expect(200);

      // The caching criterion, stated as a test: a book already in the library
      // renders identically with Open Library completely unreachable.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("caches hard, and carries the version that makes that safe", async () => {
      prisma.cover.findFirst.mockResolvedValue({
        data: PNG,
        mimeType: "image/png",
        updatedAt: STORED_AT,
      });

      const res = await as("get", "/covers/book-1").expect(200);

      expect(res.headers["cache-control"]).toContain("immutable");
      expect(res.headers.etag).toBe(`"${STORED_AT.getTime()}"`);
    });

    it("scopes the lookup to the owner (S0.3)", async () => {
      prisma.cover.findFirst.mockResolvedValue(null);

      await as("get", "/covers/someone-elses-book").expect(404);

      expect(prisma.cover.findFirst.mock.calls[0][0].where).toEqual({
        bookId: "someone-elses-book",
        book: { userId: "user-1" },
      });
    });

    it("is a 404 for a book with no cover, same as for no book at all", async () => {
      prisma.cover.findFirst.mockResolvedValue(null);

      await as("get", "/covers/book-1").expect(404);
    });
  });

  describe("PUT /books/:id/cover (S4.3)", () => {
    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue({ id: "book-1" });
    });

    it.each([
      ["JPEG", JPEG, "image/jpeg"],
      ["PNG", PNG, "image/png"],
      ["WebP", WEBP, "image/webp"],
    ])("accepts %s and stores it as an upload", async (_name, bytes, mimeType) => {
      await upload(bytes, mimeType).expect(200);

      const call = prisma.cover.upsert.mock.calls[0][0];

      expect(call.create).toEqual(
        expect.objectContaining({ bookId: "book-1", mimeType, source: "UPLOAD" }),
      );
      // Same mechanism as a downloaded cover, which is §D8's whole argument
      // for storing the image rather than a URL.
      expect(call.update).toEqual(expect.objectContaining({ mimeType, source: "UPLOAD" }));
    });

    it("answers with a URL carrying the new version", async () => {
      const res = await upload(PNG).expect(200);

      // The point of the version: the old URL is cached for a year, so a
      // replacement has to arrive under one nothing has seen.
      expect(res.body).toEqual({
        coverUrl: `/covers/book-1?v=${STORED_AT.getTime()}`,
      });
    });

    it("believes the bytes, not the Content-Type", async () => {
      // A PNG announced as a JPEG is stored — and served back — as a PNG.
      await upload(PNG, "image/jpeg").expect(200);

      expect(prisma.cover.upsert.mock.calls[0][0].create.mimeType).toBe("image/png");
    });

    it("refuses a file that is not one of the three formats", async () => {
      const res = await upload(Buffer.from("nu sunt o imagine"), "image/png").expect(400);

      expect(String(res.body.message)).toContain("JPEG, PNG sau WebP");
      expect(prisma.cover.upsert).not.toHaveBeenCalled();
    });

    it("refuses a body that is not an image at all", async () => {
      await as("put", "/books/book-1/cover")
        .set("Content-Type", "application/json")
        .send({ cover: "nope" })
        .expect(400);
    });

    it("refuses anything past the ceiling", async () => {
      // Declared, so it is turned away on the header rather than after five
      // megabytes have crossed the wire.
      const res = await upload(Buffer.alloc(COVER_MAX_BYTES + 1)).expect(413);

      expect(String(res.body.message)).toContain("5MB");
      expect(prisma.cover.upsert).not.toHaveBeenCalled();
    });

    it("is a 404 on somebody else's book, and stores nothing", async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await upload(PNG).expect(404);

      expect(prisma.cover.upsert).not.toHaveBeenCalled();
    });
  });

  describe("POST /books with an olEditionKey (S4.1, §D8)", () => {
    beforeEach(() => {
      prisma.book.create.mockResolvedValue(storedBook);
    });

    const create = () =>
      as("post", "/books").send({ title: "Dune", olEditionKey: "OL7353617M" });

    it("downloads the cover and returns the book pointing at it", async () => {
      fetchMock.mockResolvedValue(new Response(JPEG, { status: 200 }));

      const res = await create().expect(201);

      expect(String(fetchMock.mock.calls[0][0])).toContain("OL7353617M-L.jpg");
      expect(prisma.cover.upsert.mock.calls[0][0].create).toEqual(
        expect.objectContaining({ mimeType: "image/jpeg", source: "OPEN_LIBRARY" }),
      );
      expect(res.body.coverUrl).toBe(`/covers/book-1?v=${STORED_AT.getTime()}`);
    });

    it("stores the edition key on the book", async () => {
      fetchMock.mockResolvedValue(new Response(JPEG, { status: 200 }));

      await create().expect(201);

      expect(prisma.book.create.mock.calls[0][0].data.olEditionKey).toBe("OL7353617M");
    });

    it("still creates the book when Open Library is down", async () => {
      // The degradation criterion at its most load-bearing point. An external
      // image service must never be able to fail a save.
      fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));

      const res = await create().expect(201);

      expect(res.body.title).toBe("Dune");
      expect(res.body.coverUrl).toBeNull();
      expect(prisma.cover.upsert).not.toHaveBeenCalled();
    });

    it("still creates the book when the edition simply has no cover", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

      const res = await create().expect(201);

      expect(res.body.coverUrl).toBeNull();
      expect(prisma.cover.upsert).not.toHaveBeenCalled();
    });

    it("does not download anything without an edition key", async () => {
      await as("post", "/books").send({ title: "Dune" }).expect(201);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an edition key that is not one", async () => {
      await as("post", "/books")
        .send({ title: "Dune", olEditionKey: "../../etc/passwd" })
        .expect(400);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("puts coverUrl on a book that has one", async () => {
    prisma.book.findMany.mockResolvedValue([
      { ...storedBook, cover: { updatedAt: STORED_AT } },
    ]);

    const res = await as("get", "/books").expect(200);

    expect(res.body[0].coverUrl).toBe(`/covers/book-1?v=${STORED_AT.getTime()}`);
    // The version selected, never the blob: §D18's reason for the separate
    // table is that listing a library must not carry one image per row.
    expect(prisma.book.findMany.mock.calls[0][0].include).toEqual({
      cover: { select: { updatedAt: true } },
      // §D45 — the book's shelves ride along, codes only.
      categories: { select: { categoryCode: true }, orderBy: { categoryCode: "asc" } },
    });
  });
});
