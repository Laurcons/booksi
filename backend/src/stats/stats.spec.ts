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
import { currentMonth } from "../common/month";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { StatsModule } from "./stats.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

/**
 * The aggregates come back the way MariaDB sends them, which is the part worth
 * simulating: `SUM` is a decimal, not a JavaScript number, and it is NULL over
 * no rows rather than zero.
 */
const overviewRow = ({
  booksFinished = "0",
  booksReading = "0",
  pagesRead = "0",
  averageRating = null,
}: {
  booksFinished?: string | null;
  booksReading?: string | null;
  pagesRead?: string | null;
  averageRating?: string | null;
}) => [
  {
    booksFinished: booksFinished === null ? null : new Prisma.Decimal(booksFinished),
    booksReading: booksReading === null ? null : new Prisma.Decimal(booksReading),
    pagesRead: pagesRead === null ? null : new Prisma.Decimal(pagesRead),
    averageRating:
      averageRating === null ? null : new Prisma.Decimal(averageRating),
  },
];

describe("stats routes (Sprints 7–8)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn() },
    book: { count: jest.fn() },
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
        StatsModule,
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
    // No rows by default: the two routes read different shapes out of
    // `$queryRaw`, and a stub that answered one of them would hand the other a
    // row full of the wrong columns. Each test that cares supplies its own.
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.book.count.mockResolvedValue(0);
  });

  const session = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  const as = (url: string) =>
    request(app.getHttpServer()).get(url).set("Cookie", session());

  /** The SQL text of the nth raw query, with its whitespace collapsed. */
  const sql = (call = 0): string =>
    (prisma.$queryRaw.mock.calls[call][0] as { join: (s: string) => string })
      .join("?")
      .replace(/\s+/g, " ");

  describe("isolation (S0.3)", () => {
    it("refuses both routes without a session", async () => {
      const server = request(app.getHttpServer());

      await server.get("/stats/overview").expect(401);
      await server.get("/stats/by-month").expect(401);
    });

    it("binds the user id as a parameter, never as text in the statement", async () => {
      await as("/stats/overview").expect(200);

      // A tagged template reaches Prisma as (strings, ...values); the id has
      // to be among the values, which is what makes it a bound parameter.
      const [, ...values] = prisma.$queryRaw.mock.calls[0];
      expect(values).toContain("user-1");
      expect(sql()).not.toContain("user-1");
    });

    it("scopes the undated count to the session's user too", async () => {
      await as("/stats/by-month").expect(200);

      expect(prisma.book.count).toHaveBeenCalledWith({
        where: { userId: "user-1", status: "FINISHED", finishedOn: null },
      });
    });
  });

  describe("GET /stats/overview (S7.1)", () => {
    it("returns the four figures as numbers, not decimals", async () => {
      prisma.$queryRaw.mockResolvedValue(
        overviewRow({
          booksFinished: "12",
          booksReading: "3",
          pagesRead: "4210",
          averageRating: "4.2500",
        }),
      );

      const res = await as("/stats/overview").expect(200);

      expect(res.body).toEqual({
        booksFinished: 12,
        booksReading: 3,
        pagesRead: 4210,
        averageRating: 4.25,
      });
    });

    it("answers zeros for an empty library, where every SUM is NULL", async () => {
      prisma.$queryRaw.mockResolvedValue(
        overviewRow({
          booksFinished: null,
          booksReading: null,
          pagesRead: null,
        }),
      );

      const res = await as("/stats/overview").expect(200);

      expect(res.body).toEqual({
        booksFinished: 0,
        booksReading: 0,
        pagesRead: 0,
        // Not 0: no rated book is an absence of ratings, not a rating of nought.
        averageRating: null,
      });
    });

    it("counts only FINISHED as read — an abandoned book is not one (§D11)", async () => {
      await as("/stats/overview").expect(200);

      expect(sql()).toContain(
        "SUM(CASE WHEN `status` = 'FINISHED' THEN 1 ELSE 0 END) AS booksFinished",
      );
    });

    it("aggregates pages by the one rule in §D10, and by no other", async () => {
      await as("/stats/overview").expect(200);

      const statement = sql();

      // A finished book counts its whole length…
      expect(statement).toContain(
        "WHEN `status` = 'FINISHED' THEN COALESCE(`totalPages`, `pagesRead`)",
      );
      // …a book in progress or abandoned counts what was recorded (§D11)…
      expect(statement).toContain(
        "WHEN `status` IN ('READING', 'ABANDONED') THEN `pagesRead`",
      );
      // …and an unopened book counts nothing.
      expect(statement).toContain("ELSE 0 END) AS pagesRead");
    });

    it("averages over the rated books alone, by letting AVG skip the NULLs", async () => {
      await as("/stats/overview").expect(200);

      expect(sql()).toContain("AVG(`rating`) AS averageRating");
    });

    it("asks one question of the database, not four", async () => {
      // All four figures are about the same rows; four statements would be
      // four index scans and four chances to disagree.
      await as("/stats/overview").expect(200);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /stats/by-month (S7.2)", () => {
    const month = currentMonth();
    const earlier = (back: number) => {
      const [year, index] = month.split("-").map(Number);
      const total = year * 12 + (index - 1) - back;

      return `${Math.floor(total / 12)}-${`${(total % 12) + 1}`.padStart(2, "0")}`;
    };

    it("groups on finishedOn, oldest month first", async () => {
      prisma.$queryRaw.mockResolvedValue([
        { month: earlier(2), finished: new Prisma.Decimal("2") },
        { month, finished: new Prisma.Decimal("1") },
      ]);

      const res = await as("/stats/by-month").expect(200);

      expect(res.body.months.map((entry: { month: string }) => entry.month)).toEqual([
        earlier(2),
        earlier(1),
        month,
      ]);
      expect(sql()).toContain("DATE_FORMAT(`finishedOn`, '%Y-%m')");
    });

    it("fills the months nothing was finished in, at zero", async () => {
      // Same rule as S6.2: a month with no finished book is a real zero, and
      // dropping it would put January beside April at equal width.
      prisma.$queryRaw.mockResolvedValue([
        { month: earlier(2), finished: new Prisma.Decimal("2") },
      ]);

      const res = await as("/stats/by-month").expect(200);

      expect(res.body.months).toEqual([
        { month: earlier(2), finished: 2 },
        { month: earlier(1), finished: 0 },
        { month, finished: 0 },
      ]);
    });

    it("returns an empty series, not a lone zero bar, for a library with no dated finish", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const res = await as("/stats/by-month").expect(200);

      expect(res.body.months).toEqual([]);
    });

    it("counts the finished books it cannot place, as a number of books", async () => {
      // A shelf typed in retroactively arrives straight in FINISHED, so this
      // is the ordinary case rather than the edge one — and what is missing
      // from a chart of books read is books, not money.
      prisma.book.count.mockResolvedValue(7);

      const res = await as("/stats/by-month").expect(200);

      expect(res.body.undated).toBe(7);
    });

    it("counts the same population the headline figure does", async () => {
      // A re-read moves a book back to READING and keeps the date it already
      // had (S1.5). Grouping by date alone would make the bars add up to more
      // than "cărți citite" printed above them.
      await as("/stats/by-month").expect(200);

      expect(sql()).toContain("`status` = 'FINISHED'");
      expect(sql()).toContain("`finishedOn` IS NOT NULL");
    });
  });
});
