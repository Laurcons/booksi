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
import { AuditModule } from "../audit/audit.module";
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
  tokenVersion: 0,
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
  // Sprint 4 selects the cover's version alongside every book — never the
  // blob. A book without a cover row is the ordinary case.
  cover: null,
};

describe("books routes (Sprints 1–3)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    user: { findUnique: jest.fn() },
    book: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
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
        AuditModule,
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
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

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
        // S4.3 — this book has no cover row, and most books never will.
        coverUrl: null,
        createdAt: "2026-06-30T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:00.000Z",
      });
      // The foreign key is internal, and so is the cover's blob: §D18 keeps it
      // one route away precisely so that listing a library does not carry one
      // image per row.
      expect(res.body[0].userId).toBeUndefined();
      expect(res.body[0].cover).toBeUndefined();
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

    it("names the offending field in every message", async () => {
      const res = await as("post", "/books")
        .send({ title: "", genre: "COOKBOOK" })
        .expect(400);

      // One sentence per problem, each prefixed with its path. A bare
      // "Validation failed" is what this used to say, and it left the user
      // with a rejected form and nothing to act on.
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining("title:"),
          expect.stringContaining("genre:"),
        ]),
      );
    });

    it("refuses a date that looks right but names no real day", async () => {
      // The pattern alone accepts this; `new Date` would roll it forward to
      // March 3rd and store a day the user never typed.
      const res = await as("post", "/books")
        .send({ title: "Dune", finishedOn: "2026-02-31" })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("finishedOn:")]),
      );
      expect(prisma.book.create).not.toHaveBeenCalled();
    });

    it("rejects fields that belong to later sprints", async () => {
      // Nothing on the write schema yet claims `progress`: S2.2 derives it on
      // display and never stores it (§D4). Silently dropping the key would
      // look like the API accepted the value.
      await as("post", "/books")
        .send({ title: "Dune", progress: 40 })
        .expect(400);
      expect(prisma.book.create).not.toHaveBeenCalled();
    });

    it("takes progress, rating and price for a book read years ago (Sprint 2)", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books")
        .send({
          title: "Dune",
          status: "FINISHED",
          pagesRead: 620,
          rating: 5,
          paidPrice: 59.9,
        })
        .expect(201);

      const data = writtenData(prisma.book.create);
      expect(data.pagesRead).toBe(620);
      expect(data.rating).toBe(5);
      expect(data.paidPrice).toEqual(new Prisma.Decimal("59.90"));
    });

    it("refuses a rating on a book that is not finished (S2.3)", async () => {
      const res = await as("post", "/books")
        .send({ title: "Dune", status: "READING", rating: 5 })
        .expect(400);

      // Shaped like every other failure, even though this one needed the
      // status rather than the field alone.
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("rating:")]),
      );
      expect(prisma.book.create).not.toHaveBeenCalled();
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

  describe("PATCH /books/:id (S2.1, S2.3, S2.4)", () => {
    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue(storedBook);
      prisma.book.update.mockResolvedValue(storedBook);
    });

    it("records the page reached (S2.1)", async () => {
      await as("patch", "/books/book-1").send({ pagesRead: 220 }).expect(200);

      expect(writtenData(prisma.book.update).pagesRead).toBe(220);
    });

    it("accepts a page number past totalPages (§D4, §D7)", async () => {
      // storedBook says 620 pages, on Open Library's authority — for a
      // different edition than the one in the user's hands. The book they are
      // holding wins.
      await as("patch", "/books/book-1").send({ pagesRead: 700 }).expect(200);

      expect(writtenData(prisma.book.update).pagesRead).toBe(700);
    });

    it("refuses a negative page count", async () => {
      await as("patch", "/books/book-1").send({ pagesRead: -1 }).expect(400);
    });

    it("never stores a progress percentage (S2.2)", async () => {
      // The percentage is derived at display time; a client that tries to send
      // one is sending a field that does not exist.
      await as("patch", "/books/book-1").send({ progress: 35 }).expect(400);

      const res = await as("get", "/books/book-1").expect(200);
      expect(res.body).not.toHaveProperty("progress");
    });

    it("rates a finished book (S2.3)", async () => {
      prisma.book.findFirst.mockResolvedValue({ ...storedBook, status: "FINISHED" });

      await as("patch", "/books/book-1").send({ rating: 4 }).expect(200);

      expect(writtenData(prisma.book.update).rating).toBe(4);
    });

    it("rates a book in the same request that finishes it", async () => {
      // The book is stored as READING; the status it ends up in is what counts.
      await as("patch", "/books/book-1")
        .send({ status: "FINISHED", rating: 4 })
        .expect(200);

      expect(writtenData(prisma.book.update)).toMatchObject({
        status: "FINISHED",
        rating: 4,
      });
    });

    it("rates an abandoned book (§D11)", async () => {
      await as("patch", "/books/book-1")
        .send({ status: "ABANDONED", rating: 2 })
        .expect(200);

      expect(writtenData(prisma.book.update).rating).toBe(2);
    });

    it("refuses a rating while the book is still being read", async () => {
      const res = await as("patch", "/books/book-1").send({ rating: 4 }).expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("rating:")]),
      );
      expect(prisma.book.update).not.toHaveBeenCalled();
    });

    it("keeps the rating when a finished book goes back to READING", async () => {
      // A re-read is an ordinary transition (§D12); it must not silently throw
      // away the verdict from the first read.
      prisma.book.findFirst.mockResolvedValue({
        ...storedBook,
        status: "FINISHED",
        rating: 5,
      });

      await as("patch", "/books/book-1").send({ status: "READING" }).expect(200);

      expect(writtenData(prisma.book.update).rating).toBeUndefined();
    });

    it("lets a rating be cleared whatever the status", async () => {
      await as("patch", "/books/book-1").send({ rating: null }).expect(200);

      expect(writtenData(prisma.book.update).rating).toBeNull();
    });

    it("rejects half stars and out-of-range values", async () => {
      prisma.book.findFirst.mockResolvedValue({ ...storedBook, status: "FINISHED" });

      await as("patch", "/books/book-1").send({ rating: 3.5 }).expect(400);
      await as("patch", "/books/book-1").send({ rating: 0 }).expect(400);
      await as("patch", "/books/book-1").send({ rating: 6 }).expect(400);
    });

    it("stores what was paid as an exact decimal (S2.4)", async () => {
      await as("patch", "/books/book-1").send({ paidPrice: 59.9 }).expect(200);

      // Not `new Prisma.Decimal(59.9)`: the column is DECIMAL(10,2) and the
      // Sprint 6 budget sums these in SQL.
      expect(writtenData(prisma.book.update).paidPrice).toEqual(
        new Prisma.Decimal("59.90"),
      );
    });

    it("lets the paid price be cleared", async () => {
      await as("patch", "/books/book-1").send({ paidPrice: null }).expect(200);

      expect(writtenData(prisma.book.update).paidPrice).toBeNull();
    });

    it("rejects a price with a third decimal or a negative one", async () => {
      await as("patch", "/books/book-1").send({ paidPrice: 12.345 }).expect(400);
      await as("patch", "/books/book-1").send({ paidPrice: -5 }).expect(400);
    });

  });

  describe("estimatedPrice (S3.2)", () => {
    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue(storedBook);
      prisma.book.update.mockResolvedValue(storedBook);
    });

    it("stores the estimate as an exact decimal", async () => {
      await as("patch", "/books/book-1").send({ estimatedPrice: 59.9 }).expect(200);

      expect(writtenData(prisma.book.update).estimatedPrice).toEqual(
        new Prisma.Decimal("59.90"),
      );
    });

    it("keeps it apart from what was actually paid (§D6)", async () => {
      // One request, two different numbers, two different columns — the whole
      // reason they are not one field.
      await as("patch", "/books/book-1")
        .send({ estimatedPrice: 59.9, paidPrice: 45 })
        .expect(200);

      const data = writtenData(prisma.book.update);
      expect(data.estimatedPrice).toEqual(new Prisma.Decimal("59.90"));
      expect(data.paidPrice).toEqual(new Prisma.Decimal("45.00"));
    });

    it("takes the estimate at creation too", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books")
        .send({ title: "Dune", estimatedPrice: 59.9 })
        .expect(201);

      expect(writtenData(prisma.book.create).estimatedPrice).toEqual(
        new Prisma.Decimal("59.90"),
      );
    });

    it("lets a book sit in the wishlist with no price at all", async () => {
      prisma.book.create.mockResolvedValue(storedBook);

      await as("post", "/books").send({ title: "Dune" }).expect(201);

      expect(writtenData(prisma.book.create).estimatedPrice).toBeUndefined();
    });

    it("lets the estimate be cleared", async () => {
      await as("patch", "/books/book-1").send({ estimatedPrice: null }).expect(200);

      expect(writtenData(prisma.book.update).estimatedPrice).toBeNull();
    });

    it("rejects a third decimal or a negative estimate", async () => {
      await as("patch", "/books/book-1").send({ estimatedPrice: 12.345 }).expect(400);
      await as("patch", "/books/book-1").send({ estimatedPrice: -5 }).expect(400);
    });

    it("does not tie the estimate to the wishlist status", async () => {
      // storedBook is READING. Keeping the estimate after the purchase is what
      // gives the paid price something to be compared against.
      await as("patch", "/books/book-1").send({ estimatedPrice: 59.9 }).expect(200);

      expect(writtenData(prisma.book.update).status).toBeUndefined();
    });
  });

  describe("GET /books?status= (S3.1)", () => {
    it("narrows the library to the wishlist", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books?status=WISHLIST").expect(200);

      // A single value still arrives as a single value on the wire; `in` over
      // a one-element list is the same query S3.1 has always run.
      expect(prisma.book.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
        status: { in: ["WISHLIST"] },
      });
    });

    it("returns the whole library when the filter is absent", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books").expect(200);

      expect(prisma.book.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
      });
    });

    it("still sorts inside the filtered view", async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await as("get", "/books?status=WISHLIST&sort=title&order=asc").expect(200);

      const call = prisma.book.findMany.mock.calls[0][0];
      expect(call.where.status).toEqual({ in: ["WISHLIST"] });
      expect(call.orderBy).toEqual([{ title: "asc" }, { id: "asc" }]);
    });

    it("rejects a status that is not one of the five", async () => {
      await as("get", "/books?status=BORROWED").expect(400);
    });
  });

  describe("GET /books filters (S5.3)", () => {
    /** The `where` the gallery's filters ended up producing. */
    const whereFor = async (queryString: string) => {
      prisma.book.findMany.mockResolvedValue([]);
      await as("get", `/books?${queryString}`).expect(200);
      return prisma.book.findMany.mock.calls[0][0].where;
    };

    it("takes several statuses from a repeated parameter", async () => {
      expect(await whereFor("status=READING&status=FINISHED")).toEqual({
        userId: "user-1",
        status: { in: ["READING", "FINISHED"] },
      });
    });

    it("filters by genre, one value only (§D17)", async () => {
      expect(await whereFor("genre=SCIFI")).toEqual({
        userId: "user-1",
        genre: "SCIFI",
      });
    });

    it("filters by the favourite flag", async () => {
      expect(await whereFor("favorite=true")).toEqual({
        userId: "user-1",
        favorite: true,
      });
    });

    it("reads favorite=false as false, not as a non-empty string", async () => {
      // The reason the parameter is parsed from "true" | "false" rather than
      // coerced: `Boolean("false")` is `true`, and the filter would silently
      // return the opposite of what was asked for.
      expect(await whereFor("favorite=false")).toEqual({
        userId: "user-1",
        favorite: false,
      });
    });

    it("combines the three filters with AND", async () => {
      expect(
        await whereFor("status=FINISHED&genre=SCIFI&favorite=true"),
      ).toEqual({
        userId: "user-1",
        status: { in: ["FINISHED"] },
        genre: "SCIFI",
        favorite: true,
      });
    });

    it("keeps the user scope whatever the filters say", async () => {
      // S0.3 is not something a query parameter may widen.
      expect(await whereFor("favorite=true&genre=POETRY")).toMatchObject({
        userId: "user-1",
      });
    });

    it("rejects a genre outside the controlled list", async () => {
      await as("get", "/books?genre=SF").expect(400);
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it("rejects a favorite that is neither true nor false", async () => {
      await as("get", "/books?favorite=1").expect(400);
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it("rejects an unknown filter instead of ignoring it", async () => {
      // The query schema is strict for the same reason the write schemas are:
      // a typo that returns the whole library looks like a working filter.
      await as("get", "/books?favourite=true").expect(400);
    });
  });

  describe("favorite (S5.2)", () => {
    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue(storedBook);
      prisma.book.update.mockResolvedValue({ ...storedBook, favorite: true });
    });

    it("marks a book through the ordinary edit route (§D30)", async () => {
      await as("patch", "/books/book-1").send({ favorite: true }).expect(200);

      expect(writtenData(prisma.book.update).favorite).toBe(true);
    });

    it("unmarks it again", async () => {
      prisma.book.findFirst.mockResolvedValue({ ...storedBook, favorite: true });
      prisma.book.update.mockResolvedValue(storedBook);

      await as("patch", "/books/book-1").send({ favorite: false }).expect(200);

      expect(writtenData(prisma.book.update).favorite).toBe(false);
    });

    it("marks a wishlist book, which is the point of §D14", async () => {
      // Orthogonal to status: no cross-field rule stands between a book
      // nobody has bought yet and the star on its card.
      prisma.book.findFirst.mockResolvedValue({
        ...storedBook,
        status: "WISHLIST",
      });

      await as("patch", "/books/book-1").send({ favorite: true }).expect(200);

      expect(writtenData(prisma.book.update).favorite).toBe(true);
      expect(writtenData(prisma.book.update).status).toBeUndefined();
    });

    it("leaves the flag alone when the request does not mention it", async () => {
      await as("patch", "/books/book-1").send({ title: "Dune Messiah" }).expect(200);

      expect(writtenData(prisma.book.update).favorite).toBeUndefined();
    });

    it("takes the flag at creation too", async () => {
      prisma.book.create.mockResolvedValue({ ...storedBook, favorite: true });

      await as("post", "/books")
        .send({ title: "Dune", favorite: true })
        .expect(201);

      expect(writtenData(prisma.book.create).favorite).toBe(true);
    });

    it("refuses a value that is not a boolean", async () => {
      await as("patch", "/books/book-1").send({ favorite: "true" }).expect(400);

      expect(prisma.book.update).not.toHaveBeenCalled();
    });

    it("returns the flag on read, as it has since Sprint 1", async () => {
      prisma.book.findFirst.mockResolvedValue({ ...storedBook, favorite: true });

      const res = await as("get", "/books/book-1").expect(200);

      expect(res.body.favorite).toBe(true);
    });
  });

  describe("GET /books/wishlist-summary (S3.3)", () => {
    const aggregated = (
      total: string | null,
      priced: number,
      count: number,
    ) => ({
      _sum: { estimatedPrice: total === null ? null : new Prisma.Decimal(total) },
      _count: { _all: count, estimatedPrice: priced },
    });

    it("reports the total together with how much of the list it covers", async () => {
      prisma.book.aggregate.mockResolvedValue(aggregated("340.00", 7, 11));

      const res = await as("get", "/books/wishlist-summary").expect(200);

      // "total 340 lei — 7 din 11 cărți au preț estimat".
      expect(res.body).toEqual({ total: 340, priced: 7, count: 11 });
    });

    it("sums over the wishlist only, and over the session's user", async () => {
      prisma.book.aggregate.mockResolvedValue(aggregated("0.00", 0, 0));

      await as("get", "/books/wishlist-summary").expect(200);

      expect(prisma.book.aggregate.mock.calls[0][0].where).toEqual({
        userId: "user-1",
        status: "WISHLIST",
      });
    });

    it("answers 0 for an empty wishlist rather than null", async () => {
      // SUM over no rows is NULL in SQL; nothing to buy costs nothing.
      prisma.book.aggregate.mockResolvedValue(aggregated(null, 0, 0));

      const res = await as("get", "/books/wishlist-summary").expect(200);

      expect(res.body).toEqual({ total: 0, priced: 0, count: 0 });
    });

    it("counts unpriced books in the coverage but not in the total", async () => {
      prisma.book.aggregate.mockResolvedValue(aggregated("59.90", 1, 4));

      const res = await as("get", "/books/wishlist-summary").expect(200);

      expect(res.body).toEqual({ total: 59.9, priced: 1, count: 4 });
    });

    it("does not route through :id", async () => {
      // Same declaration-order trap as isbn-duplicates.
      prisma.book.aggregate.mockResolvedValue(aggregated(null, 0, 0));

      await as("get", "/books/wishlist-summary").expect(200);
      expect(prisma.book.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("POST /books/:id/purchase (S3.4)", () => {
    const wishlistBook = {
      ...storedBook,
      status: "WISHLIST" as const,
      purchasedOn: null,
      startedOn: null,
      paidPrice: null,
      estimatedPrice: new Prisma.Decimal("59.90"),
    };

    const today = () => new Date(`${todayCalendarDate()}T00:00:00.000Z`);

    beforeEach(() => {
      prisma.book.findFirst.mockResolvedValue(wishlistBook);
      prisma.book.update.mockResolvedValue({ ...wishlistBook, status: "PURCHASED" });
    });

    it("sets status, date and price in one click", async () => {
      await as("post", "/books/book-1/purchase").expect(200);

      expect(writtenData(prisma.book.update)).toEqual({
        status: "PURCHASED",
        purchasedOn: today(),
        paidPrice: new Prisma.Decimal("59.90"),
      });
    });

    it("leaves the paid price empty when there is no estimate, without failing", async () => {
      prisma.book.findFirst.mockResolvedValue({
        ...wishlistBook,
        estimatedPrice: null,
      });

      await as("post", "/books/book-1/purchase").expect(200);

      const data = writtenData(prisma.book.update);
      expect(data.status).toBe("PURCHASED");
      // Untouched, not cleared: a one-click action erases nothing.
      expect(data.paidPrice).toBeUndefined();
    });

    it("overwrites an earlier purchase date", async () => {
      // S1.5 never overwrites a recorded date, but this is an explicit "I
      // bought it" — a book sent back to the wishlist and bought again was
      // bought today.
      prisma.book.findFirst.mockResolvedValue({
        ...wishlistBook,
        purchasedOn: new Date("2024-02-02T00:00:00Z"),
      });

      await as("post", "/books/book-1/purchase").expect(200);

      expect(writtenData(prisma.book.update).purchasedOn).toEqual(today());
    });

    it("touches nothing else", async () => {
      await as("post", "/books/book-1/purchase").expect(200);

      const data = writtenData(prisma.book.update);
      expect(data.estimatedPrice).toBeUndefined();
      expect(data.rating).toBeUndefined();
      expect(data.pagesRead).toBeUndefined();
      expect(data.startedOn).toBeUndefined();
    });

    it("answers 404 for a book that is not yours", async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await as("post", "/books/foreign-id/purchase").expect(404);
      expect(prisma.book.update).not.toHaveBeenCalled();
    });

    it("refuses without a session", async () => {
      await request(app.getHttpServer())
        .post("/books/book-1/purchase")
        .expect(401);
    });

    it("leaves all three fields editable afterwards", async () => {
      await as("post", "/books/book-1/purchase").expect(200);

      prisma.book.update.mockClear();
      prisma.book.findFirst.mockResolvedValue({
        ...wishlistBook,
        status: "PURCHASED",
        purchasedOn: today(),
        paidPrice: new Prisma.Decimal("59.90"),
      });

      await as("patch", "/books/book-1")
        .send({ paidPrice: 45, purchasedOn: "2026-08-01" })
        .expect(200);

      expect(writtenData(prisma.book.update)).toMatchObject({
        paidPrice: new Prisma.Decimal("45.00"),
        purchasedOn: new Date("2026-08-01T00:00:00.000Z"),
      });
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
