import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { BooksModule } from "../books/books.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { ChallengesModule } from "./challenges.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

/** A book row as `BooksService.findByIds`/`countOwned` would see it — full
 * shape so `toBook` (private to `BooksService`) has everything it expects. */
function storedBook(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "book-1",
    userId: "user-1",
    title: "Solaris",
    author: "Stanisław Lem",
    isbn: null,
    totalPages: 264,
    genre: "SCIFI" as const,
    olEditionKey: null,
    status: "FINISHED" as const,
    favorite: false,
    pagesRead: 264,
    rating: 5,
    estimatedPrice: null,
    paidPrice: null,
    purchasedOn: null,
    startedOn: null,
    finishedOn: new Date("2026-07-20T00:00:00Z"),
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-07-20T00:00:00Z"),
    cover: null,
    ...overrides,
  };
}

const storedChallenge = {
  id: "challenge-1",
  userId: "user-1",
  title: "Provocarea de vară",
  description: null,
  deadline: new Date("2026-08-31T00:00:00Z"),
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
};

describe("challenges routes", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    user: { findUnique: jest.fn() },
    book: { findMany: jest.fn(), count: jest.fn() },
    challenge: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    challengeBook: { upsert: jest.fn(), deleteMany: jest.fn() },
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
        ChallengesModule,
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

  const session = () => `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  const as = (method: "get" | "post" | "patch" | "delete", url: string) =>
    request(app.getHttpServer())[method](url).set("Cookie", session());

  describe("isolation (S0.3)", () => {
    it("refuses every route without a session", async () => {
      const server = request(app.getHttpServer());

      await server.get("/challenges").expect(401);
      await server.get("/challenges/challenge-1").expect(401);
      await server.post("/challenges").send({ title: "x", deadline: "2026-08-31" }).expect(401);
      await server.patch("/challenges/challenge-1").send({ title: "x" }).expect(401);
      await server.delete("/challenges/challenge-1").expect(401);
      await server.post("/challenges/challenge-1/books").send({ bookId: "book-1" }).expect(401);
      await server.delete("/challenges/challenge-1/books/book-1").expect(401);
    });

    it("answers 404 — not 403 — for a challenge in somebody else's library", async () => {
      prisma.challenge.findFirst.mockResolvedValue(null);

      await as("get", "/challenges/foreign-id").expect(404);
      await as("patch", "/challenges/foreign-id").send({ title: "x" }).expect(404);
      await as("post", "/challenges/foreign-id/books")
        .send({ bookId: "book-1" })
        .expect(404);
    });

    it("answers 404 when deleting a challenge that is not yours", async () => {
      prisma.challenge.deleteMany.mockResolvedValue({ count: 0 });

      await as("delete", "/challenges/foreign-id").expect(404);
      expect(prisma.challenge.deleteMany.mock.calls[0][0].where).toEqual({
        id: "foreign-id",
        userId: "user-1",
      });
    });
  });

  describe("GET /challenges", () => {
    it("returns the summary shape, not the full books", async () => {
      prisma.challenge.findMany.mockResolvedValue([
        {
          ...storedChallenge,
          books: [
            { book: { status: "FINISHED" } },
            { book: { status: "READING" } },
            { book: { status: "PURCHASED" } },
          ],
        },
      ]);

      const res = await as("get", "/challenges").expect(200);

      expect(res.body[0]).toEqual({
        id: "challenge-1",
        title: "Provocarea de vară",
        description: null,
        deadline: "2026-08-31",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        bookCount: 3,
        finishedCount: 1,
      });
      expect(res.body[0].books).toBeUndefined();
    });
  });

  describe("GET /challenges/:id", () => {
    it("embeds full book rows, in attach order", async () => {
      prisma.challenge.findFirst.mockResolvedValue({
        ...storedChallenge,
        books: [{ bookId: "book-2" }, { bookId: "book-1" }],
      });
      prisma.book.findMany.mockResolvedValue([
        storedBook({ id: "book-1", title: "Solaris" }),
        storedBook({ id: "book-2", title: "Dune" }),
      ]);

      const res = await as("get", "/challenges/challenge-1").expect(200);

      expect(res.body.title).toBe("Provocarea de vară");
      expect(res.body.deadline).toBe("2026-08-31");
      // `book-2` was attached first, so it comes first — even though
      // `findMany` handed the rows back in a different order.
      expect(res.body.books.map((b: { id: string }) => b.id)).toEqual(["book-2", "book-1"]);
    });
  });

  describe("POST /challenges", () => {
    it("creates without books", async () => {
      prisma.challenge.create.mockResolvedValue({ ...storedChallenge, id: "new-id" });
      prisma.challenge.findFirst.mockResolvedValue({ ...storedChallenge, id: "new-id", books: [] });

      const res = await as("post", "/challenges")
        .send({ title: "Provocarea de vară", deadline: "2026-08-31" })
        .expect(201);

      expect(res.body.books).toEqual([]);
      expect(prisma.book.count).not.toHaveBeenCalled();
    });

    it("checks ownership of every bookId before writing anything", async () => {
      prisma.book.count.mockResolvedValue(1); // only 1 of the 2 requested ids is owned

      await as("post", "/challenges")
        .send({ title: "x", deadline: "2026-08-31", bookIds: ["book-1", "book-2"] })
        .expect(404);

      expect(prisma.challenge.create).not.toHaveBeenCalled();
    });

    it("attaches the given books when all are owned", async () => {
      prisma.book.count.mockResolvedValue(2);
      prisma.challenge.create.mockResolvedValue({ ...storedChallenge, id: "new-id" });
      prisma.challenge.findFirst.mockResolvedValue({
        ...storedChallenge,
        id: "new-id",
        books: [{ bookId: "book-1" }, { bookId: "book-2" }],
      });
      prisma.book.findMany.mockResolvedValue([
        storedBook({ id: "book-1" }),
        storedBook({ id: "book-2" }),
      ]);

      await as("post", "/challenges")
        .send({ title: "x", deadline: "2026-08-31", bookIds: ["book-1", "book-2"] })
        .expect(201);

      expect(prisma.challenge.create.mock.calls[0][0].data.books).toEqual({
        create: [{ bookId: "book-1" }, { bookId: "book-2" }],
      });
    });
  });

  describe("PATCH /challenges/:id", () => {
    it("writes only the fields sent, converting the deadline to a calendar date", async () => {
      prisma.challenge.findFirst.mockResolvedValue({ ...storedChallenge, books: [] });
      prisma.challenge.update.mockResolvedValue(storedChallenge);

      await as("patch", "/challenges/challenge-1").send({ deadline: "2026-09-15" }).expect(200);

      expect(prisma.challenge.update.mock.calls[0][0].data).toEqual({
        title: undefined,
        description: undefined,
        deadline: new Date("2026-09-15T00:00:00.000Z"),
      });
    });
  });

  describe("POST /challenges/:id/books and DELETE .../books/:bookId", () => {
    beforeEach(() => {
      prisma.challenge.findFirst.mockResolvedValue({ ...storedChallenge, books: [] });
      prisma.book.findMany.mockResolvedValue([storedBook()]);
    });

    it("attaches a book idempotently via upsert on the composite key", async () => {
      prisma.book.count.mockResolvedValue(1);

      await as("post", "/challenges/challenge-1/books").send({ bookId: "book-1" }).expect(200);

      expect(prisma.challengeBook.upsert.mock.calls[0][0]).toMatchObject({
        where: { challengeId_bookId: { challengeId: "challenge-1", bookId: "book-1" } },
      });
    });

    it("refuses to attach a book that is not the user's", async () => {
      prisma.book.count.mockResolvedValue(0);

      await as("post", "/challenges/challenge-1/books").send({ bookId: "foreign-book" }).expect(404);
      expect(prisma.challengeBook.upsert).not.toHaveBeenCalled();
    });

    it("detaches a book, and does not fail when it was never attached", async () => {
      prisma.challengeBook.deleteMany.mockResolvedValue({ count: 0 });

      await as("delete", "/challenges/challenge-1/books/book-1").expect(200);

      expect(prisma.challengeBook.deleteMany.mock.calls[0][0]).toEqual({
        where: { challengeId: "challenge-1", bookId: "book-1" },
      });
    });
  });
});
