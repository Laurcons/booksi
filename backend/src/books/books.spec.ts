import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { BooksModule } from "./books.module";
import { todayCalendarDate } from "./calendar-date";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

/** A full row, as Prisma hands it over — blob-free, but with everything else. */
const storedBook = {
  id: "book-1",
  userId: "user-1",
  title: "Dune",
  author: "Frank Herbert",
  isbn: "978-606-4-00000-0",
  totalPages: 620,
  genre: "SCIFI" as const,
  olEditionKey: null,
  status: "READING" as const,
  favorite: false,
  pagesRead: 143,
  rating: null,
  estimatedPrice: new Prisma.Decimal("59.90"),
  paidPrice: null,
  purchasedOn: new Date("2026-07-01T00:00:00Z"),
  startedOn: new Date("2026-07-20T00:00:00Z"),
  finishedOn: null,
  createdAt: new Date("2026-06-30T10:00:00Z"),
  updatedAt: new Date("2026-07-20T10:00:00Z"),
  manuallyEditedFields: { fields: ["title"] },
};

describe("books routes (Sprint 1)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    user: { findUnique: jest.fn() },
    book: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

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
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(storedUser);
  });

  const session = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken({ id: storedUser.id })}`;

  const as = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app.getHttpServer())[method](url).set("Cookie", session());

  /** What the service actually asked Prisma to write. */
  const writtenData = (mock: jest.Mock) => mock.mock.calls[0][0].data;

  describe("isolation (S0.3)", () => {
    it("refuses every route without a session", async () => {
      const server = request(app.getHttpServer());

      await server.get("/books").expect(401);
      await server.get("/books/book-1").expect(401);
      await server.post("/books").send({ title: "Dune" }).expect(401);
      await server.patch("/books/book-1").send({ title: "Dune" }).expect(401);
      await server.delete("/books/book-1").expect(401);
    });

    it("scopes the listing to the session's user, never to a parameter", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books?userId=someone-else").expect(400);

      prisma.book.findMany.mockClear();
      await as("get", "/books").expect(200);
      expect(prisma.book.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
      });
    });

    it("answers 404 — not 403 — for a book in somebody else's library", async () => {
      // `findFirst` is already scoped by userId, so another user's id simply
      // finds nothing. The response must not distinguish the two cases.
      prisma.book.findFirst.mockResolvedValue(null);

      await as("get", "/books/foreign-id").expect(404);
      await as("patch", "/books/foreign-id").send({ title: "x" }).expect(404);
    });

    it("answers 404 when deleting a book that is not yours", async () => {
      prisma.book.deleteMany.mockResolvedValue({ count: 0 });

      await as("delete", "/books/foreign-id").expect(404);
      expect(prisma.book.deleteMany.mock.calls[0][0].where).toEqual({
        id: "foreign-id",
        userId: "user-1",
      });
    });
  });

  describe("GET /books (S1.2)", () => {
    it("shapes the row for the table and hides internal bookkeeping", async () => {
      prisma.book.findMany.mockResolvedValue([storedBook]);

      const res = await as("get", "/books").expect(200);

      expect(res.body[0]).toEqual({
        id: "book-1",
        title: "Dune",
        author: "Frank Herbert",
        isbn: "978-606-4-00000-0",
        totalPages: 620,
        genre: "SCIFI",
        status: "READING",
        favorite: false,
        pagesRead: 143,
        rating: null,
        // Decimal crosses the wire as a number, not as an object.
        estimatedPrice: 59.9,
        paidPrice: null,
        purchasedOn: "2026-07-01",
        startedOn: "2026-07-20",
        finishedOn: null,
        createdAt: "2026-06-30T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:00.000Z",
      });
      // S4.4's field is internal; so is the foreign key.
      expect(res.body[0].manuallyEditedFields).toBeUndefined();
      expect(res.body[0].userId).toBeUndefined();
    });

    it("defaults to newest first", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books").expect(200);

      expect(prisma.book.findMany.mock.calls[0][0].orderBy).toEqual([
        { createdAt: "desc" },
        { id: "asc" },
      ]);
    });

    it("sorts by the four documented columns", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      for (const sort of ["title", "author", "status", "createdAt"]) {
        prisma.book.findMany.mockClear();
        await as("get", `/books?sort=${sort}&order=asc`).expect(200);

        expect(prisma.book.findMany.mock.calls[0][0].orderBy).toEqual([
          { [sort]: "asc" },
          { id: "asc" },
        ]);
      }
    });

    it("rejects a sort column that is not on the list", async () => {
      // The value reaches an `orderBy` key, so an open-ended one would let a
      // caller order by any column in the table.
      await as("get", "/books?sort=paidPrice").expect(400);
      await as("get", "/books?order=sideways").expect(400);
    });
  });

  describe("POST /books (S1.1)", () => {
    it("accepts a title and nothing else", async () => {
      prisma.book.create.mockResolvedValue({ ...storedBook, status: "WISHLIST" });

      await as("post", "/books").send({ title: "Dune" }).expect(201);

      expect(writtenData(prisma.book.create)).toMatchObject({
        title: "Dune",
        userId: "user-1",
      });
    });

    it("refuses a book with no title", async () => {
      await as("post", "/books").send({}).expect(400);
      await as("post", "/books").send({ title: "   " }).expect(400);
    });

    it("reports validation failures per field, for the form to attach", async () => {
      const res = await as("post", "/books")
        .send({ title: "", genre: "COOKBOOK" })
        .expect(400);

      expect(Object.keys(res.body.errors)).toEqual(
        expect.arrayContaining(["title", "genre"]),
      );
    });

    it("rejects fields that belong to later sprints", async () => {
      // rating is S2.3, paidPrice is S2.4. Silently dropping them would look
      // like the API accepted the value.
      await as("post", "/books")
        .send({ title: "Dune", rating: 5 })
        .expect(400);
      await as("post", "/books")
        .send({ title: "Dune", paidPrice: 59.9 })
        .expect(400);
    });

    it("turns a cleared optional field into NULL rather than an empty string", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books")
        .send({ title: "Dune", author: "", isbn: "" })
        .expect(201);

      expect(writtenData(prisma.book.create)).toMatchObject({
        author: null,
        isbn: null,
      });
    });

    it("stamps the date when a book is added as already finished (S1.5)", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books")
        .send({ title: "Dune", status: "FINISHED" })
        .expect(201);

      expect(writtenData(prisma.book.create).finishedOn).toEqual(
        new Date(`${todayCalendarDate()}T00:00:00.000Z`),
      );
    });

    it("keeps the date the user gave for a book read years ago", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books")
        .send({ title: "Dune", status: "FINISHED", finishedOn: "2019-03-01" })
        .expect(201);

      expect(writtenData(prisma.book.create).finishedOn).toEqual(
        new Date("2019-03-01T00:00:00.000Z"),
      );
    });

    it("stamps nothing for a plain wishlist entry", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books").send({ title: "Dune" }).expect(201);

      const data = writtenData(prisma.book.create);
      expect(data.purchasedOn).toBeUndefined();
      expect(data.startedOn).toBeUndefined();
      expect(data.finishedOn).toBeUndefined();
    });

    it("rejects a date that is not a calendar day", async () => {
      await as("post", "/books")
        .send({ title: "Dune", finishedOn: "2019-03-01T12:00:00Z" })
        .expect(400);
    });
  });

  describe("PATCH /books/:id (S1.3, S1.4, S1.5)", () => {
    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue(storedBook);
      prisma.book.update.mockResolvedValue(storedBook);
    });

    it("stamps the transition date", async () => {
      await as("patch", "/books/book-1").send({ status: "FINISHED" }).expect(200);

      expect(writtenData(prisma.book.update).finishedOn).toEqual(
        new Date(`${todayCalendarDate()}T00:00:00.000Z`),
      );
    });

    it("allows any transition, in any order (§D12)", async () => {
      // Straight from READING back to WISHLIST — nonsensical as a flow, but
      // the flow is a suggestion, not a constraint.
      await as("patch", "/books/book-1").send({ status: "WISHLIST" }).expect(200);

      expect(writtenData(prisma.book.update).status).toBe("WISHLIST");
    });

    it("keeps the original start date when a book is re-read", async () => {
      prisma.book.findFirst.mockResolvedValue({
        ...storedBook,
        status: "FINISHED",
        finishedOn: new Date("2020-01-01T00:00:00Z"),
      });

      await as("patch", "/books/book-1").send({ status: "READING" }).expect(200);

      // startedOn was already 2026-07-20 and is history now.
      expect(writtenData(prisma.book.update).startedOn).toBeUndefined();
    });

    it("lets the user correct a date without touching the status", async () => {
      await as("patch", "/books/book-1")
        .send({ startedOn: "2026-07-19" })
        .expect(200);

      expect(writtenData(prisma.book.update).startedOn).toEqual(
        new Date("2026-07-19T00:00:00.000Z"),
      );
    });

    it("lets the user clear a date", async () => {
      await as("patch", "/books/book-1").send({ startedOn: null }).expect(200);

      expect(writtenData(prisma.book.update).startedOn).toBeNull();
    });

    it("leaves untouched fields untouched", async () => {
      await as("patch", "/books/book-1").send({ title: "Dune (ed. nouă)" }).expect(200);

      const data = writtenData(prisma.book.update);
      expect(data.title).toBe("Dune (ed. nouă)");
      // `undefined` is Prisma's "do not change", which is exactly the point.
      expect(data.author).toBeUndefined();
      expect(data.status).toBeUndefined();
      expect(data.purchasedOn).toBeUndefined();
    });
  });

  describe("DELETE /books/:id (S1.3)", () => {
    it("removes the book and answers 204", async () => {
      prisma.book.deleteMany.mockResolvedValue({ count: 1 });

      await as("delete", "/books/book-1").expect(204);
    });
  });

  describe("GET /books/isbn-duplicates (S1.1, §D13)", () => {
    it("matches regardless of how the ISBN is punctuated", async () => {
      prisma.book.findMany.mockResolvedValue([
        { id: "book-1", title: "Dune", author: "Frank Herbert", isbn: "978-606-4-1" },
        { id: "book-2", title: "Altceva", author: null, isbn: "9781234567897" },
      ]);

      const res = await as("get", "/books/isbn-duplicates?isbn=9786064 1").expect(200);

      expect(res.body).toEqual([
        { id: "book-1", title: "Dune", author: "Frank Herbert" },
      ]);
    });

    it("does not route through :id", async () => {
      // Declaration order decides this; a regression would 404 with a book id
      // of "isbn-duplicates".
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books/isbn-duplicates?isbn=123").expect(200);
      expect(prisma.book.findFirst).not.toHaveBeenCalled();
    });

    it("skips the book being edited, so it is not its own duplicate", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books/isbn-duplicates?isbn=123&excludeId=book-1").expect(200);

      expect(prisma.book.findMany.mock.calls[0][0].where).toMatchObject({
        userId: "user-1",
        id: { not: "book-1" },
      });
    });

    it("never blocks: duplicates are reported, and the book still saves", async () => {
      prisma.book.findMany.mockResolvedValue([
        { id: "book-1", title: "Dune", author: null, isbn: "9786064" },
      ]);
      prisma.book.create.mockResolvedValue(storedBook);

      const warned = await as("get", "/books/isbn-duplicates?isbn=9786064").expect(200);
      expect(warned.body).toHaveLength(1);

      await as("post", "/books")
        .send({ title: "Dune", isbn: "9786064" })
        .expect(201);
    });
  });
});
