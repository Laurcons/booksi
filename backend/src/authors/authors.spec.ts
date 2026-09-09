import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { AuthorsModule } from "./authors.module";

/**
 * §D51 — the author entity's routes.
 *
 * Four behaviours carry the whole design and each one has a test here that
 * would fail loudly if it regressed: creation is idempotent by name, the
 * biography is the only editable field, deleting reports how many books it
 * touched, and every route refuses another account's author with a 404 rather
 * than a 403 (S0.3).
 */

const storedUser = {
  id: "user-1",
  googleId: "g-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  isAdmin: false,
  tokenVersion: 0,
  locale: "ro",
};

const storedAuthor = {
  id: "author-1",
  userId: "user-1",
  name: "Frank Herbert",
  biography: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("authors routes (§D51)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    user: { findUnique: jest.fn() },
    author: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
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
        AuthorsModule,
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

  describe("GET /authors", () => {
    it("flattens the book count and leaves the biography out", async () => {
      prisma.author.findMany.mockResolvedValue([
        { id: "author-1", name: "Frank Herbert", _count: { books: 3 } },
      ]);

      const res = await as("get", "/authors").expect(200);

      expect(res.body).toEqual([
        { id: "author-1", name: "Frank Herbert", bookCount: 3 },
      ]);
      // A dropdown never shows a biography, and one is up to 5000 characters.
      expect(res.body[0].biography).toBeUndefined();
    });

    /**
     * The absent-vs-empty rule (§D29), and here it is what makes the picker
     * usable for housekeeping: §D51 leaves no author screen, so deleting an
     * author no book points at has to be reachable without knowing its name.
     */
    it("answers an absent q with the whole list, not with nothing", async () => {
      prisma.author.findMany.mockResolvedValue([]);

      await as("get", "/authors").expect(200);

      expect(prisma.author.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
      });
    });

    it("treats an empty q as absent, so ?q= is not a search for everything", async () => {
      prisma.author.findMany.mockResolvedValue([]);

      await as("get", "/authors?q=").expect(200);

      expect(prisma.author.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
      });
    });

    it("filters by name when q is given, in name order", async () => {
      prisma.author.findMany.mockResolvedValue([]);

      await as("get", "/authors?q=herb").expect(200);

      const call = prisma.author.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "user-1", name: { contains: "herb" } });
      expect(call.orderBy).toEqual({ name: "asc" });
    });

    it("is scoped to the session's user, never a parameter (S0.3)", async () => {
      prisma.author.findMany.mockResolvedValue([]);

      await as("get", "/authors").expect(200);

      expect(prisma.author.findMany.mock.calls[0][0].where.userId).toBe("user-1");
    });
  });

  describe("GET /authors/:id", () => {
    it("carries the biography and the book count", async () => {
      prisma.author.findFirst.mockResolvedValue({
        ...storedAuthor,
        biography: "Autor american de SF.",
        _count: { books: 3 },
      });

      const res = await as("get", "/authors/author-1").expect(200);

      expect(res.body).toEqual({
        id: "author-1",
        name: "Frank Herbert",
        biography: "Autor american de SF.",
        bookCount: 3,
      });
      // The mapping is the boundary that keeps internals out of the response.
      expect(res.body.userId).toBeUndefined();
    });

    it("answers 404 for somebody else's author, not 403 (S0.3)", async () => {
      prisma.author.findFirst.mockResolvedValue(null);

      const res = await as("get", "/authors/author-of-another-user").expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /authors", () => {
    it("creates the author the reader confirmed", async () => {
      prisma.author.create.mockResolvedValue(storedAuthor);

      const res = await as("post", "/authors")
        .send({ name: "Frank Herbert" })
        .expect(201);

      expect(prisma.author.create.mock.calls[0][0].data).toEqual({
        userId: "user-1",
        name: "Frank Herbert",
      });
      expect(res.body).toEqual({
        id: "author-1",
        name: "Frank Herbert",
        biography: null,
      });
    });

    /**
     * §D51 — idempotent by name rather than 409-on-collision.
     *
     * The client only offers to create when nothing matched, and it folds names
     * exactly as the unique index does, so a collision here means two tabs or a
     * stale dropdown. Both want the same answer — *give me the author for this
     * name* — and neither wants an error the reader has to read and act on.
     */
    it("returns the existing author when the name is taken, rather than failing", async () => {
      prisma.author.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "6",
        }),
      );
      prisma.author.findFirst.mockResolvedValue(storedAuthor);

      const res = await as("post", "/authors")
        .send({ name: "frank herbert" })
        .expect(201);

      expect(res.body.id).toBe("author-1");
      // Looked up under the column's own collation, which is what folded the
      // two spellings together in the first place.
      expect(prisma.author.findFirst.mock.calls[0][0].where).toEqual({
        userId: "user-1",
        name: "frank herbert",
      });
    });

    it("refuses a blank name", async () => {
      const res = await as("post", "/authors").send({ name: "   " }).expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(prisma.author.create).not.toHaveBeenCalled();
    });

    /**
     * A biography is written *after* the author exists. Refused rather than
     * ignored, which is this API's rule for a field a route does not own — the
     * request said something it believed and deserves to be told otherwise.
     */
    it("refuses a biography on creation", async () => {
      await as("post", "/authors")
        .send({ name: "Frank Herbert", biography: "Ceva." })
        .expect(400);

      expect(prisma.author.create).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /authors/:id", () => {
    it("writes the biography", async () => {
      prisma.author.updateMany.mockResolvedValue({ count: 1 });
      prisma.author.findFirst.mockResolvedValue({
        ...storedAuthor,
        biography: "Autor american de SF.",
        _count: { books: 3 },
      });

      const res = await as("patch", "/authors/author-1")
        .send({ biography: "Autor american de SF." })
        .expect(200);

      expect(prisma.author.updateMany.mock.calls[0][0]).toEqual({
        // Scoped to the user in the same statement that writes: the count it
        // returns is the ownership answer (S0.3).
        where: { id: "author-1", userId: "user-1" },
        data: { biography: "Autor american de SF." },
      });
      expect(res.body.biography).toBe("Autor american de SF.");
    });

    it("turns an emptied box into NULL rather than an empty string", async () => {
      prisma.author.updateMany.mockResolvedValue({ count: 1 });
      prisma.author.findFirst.mockResolvedValue({
        ...storedAuthor,
        _count: { books: 0 },
      });

      await as("patch", "/authors/author-1").send({ biography: "" }).expect(200);

      expect(prisma.author.updateMany.mock.calls[0][0].data).toEqual({
        biography: null,
      });
    });

    /**
     * §D51 — the name cannot be edited anywhere. On the wire, correcting a typo
     * and merging two people are the same request, and the second one rewrites
     * every book that pointed at the old name.
     */
    it("refuses a name change", async () => {
      const res = await as("patch", "/authors/author-1")
        .send({ name: "Frank P. Herbert" })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(prisma.author.updateMany).not.toHaveBeenCalled();
    });

    it("answers 404 for somebody else's author", async () => {
      prisma.author.updateMany.mockResolvedValue({ count: 0 });

      const res = await as("patch", "/authors/author-1")
        .send({ biography: "Ceva." })
        .expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /authors/:id", () => {
    /**
     * The books stay, without an author — `onDelete: SetNull` on the foreign
     * key, so there is no window in which an author is gone and a book still
     * points at it. The count comes back because it may have moved since the
     * confirmation was drawn.
     */
    it("reports how many books lost their author", async () => {
      prisma.author.findFirst.mockResolvedValue({
        id: "author-1",
        _count: { books: 4 },
      });
      prisma.author.delete.mockResolvedValue(storedAuthor);

      const res = await as("delete", "/authors/author-1").expect(200);

      expect(res.body).toEqual({ booksAffected: 4 });
      expect(prisma.author.delete.mock.calls[0][0]).toEqual({
        where: { id: "author-1" },
      });
    });

    it("reports zero for an author nobody's books point at", async () => {
      prisma.author.findFirst.mockResolvedValue({
        id: "author-1",
        _count: { books: 0 },
      });
      prisma.author.delete.mockResolvedValue(storedAuthor);

      const res = await as("delete", "/authors/author-1").expect(200);

      // The number the interface uses to decide it needs no confirmation.
      expect(res.body).toEqual({ booksAffected: 0 });
    });

    it("answers 404 for somebody else's author, and deletes nothing", async () => {
      prisma.author.findFirst.mockResolvedValue(null);

      const res = await as("delete", "/authors/author-1").expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
      expect(prisma.author.delete).not.toHaveBeenCalled();
    });
  });

  it("requires a session on every route (S0.3)", async () => {
    const routes: [("get" | "post" | "patch" | "delete"), string][] = [
      ["get", "/authors"],
      ["get", "/authors/author-1"],
      ["post", "/authors"],
      ["patch", "/authors/author-1"],
      ["delete", "/authors/author-1"],
    ];

    for (const [method, url] of routes) {
      await request(app.getHttpServer())[method](url).expect(401);
    }
  });
});
