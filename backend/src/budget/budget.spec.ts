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
import { currentMonth, monthRange } from "../common/month";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { BudgetModule } from "./budget.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

const decimal = (value: string | null) =>
  value === null ? null : new Prisma.Decimal(value);

/** One `book.aggregate` answer: a sum, and optionally a row count. */
const sum = (total: string | null, books = 0) => ({
  _sum: { paidPrice: decimal(total) },
  _count: { _all: books },
});

describe("budget routes (Sprint 6)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn() },
    book: { aggregate: jest.fn() },
    settings: { findUnique: jest.fn() },
  };

  /**
   * The three aggregates `summary` runs differ only by their `where`, so the
   * stub answers by predicate rather than by call order — `Promise.all` makes
   * the order an implementation detail no test should depend on.
   */
  const spending = ({
    total = "0.00",
    thisMonth = "0.00",
    undated = "0.00",
    undatedBooks = 0,
  }: {
    total?: string | null;
    thisMonth?: string | null;
    undated?: string | null;
    undatedBooks?: number;
  }) => {
    prisma.book.aggregate.mockImplementation(
      ({ where }: { where: { purchasedOn?: unknown } }) => {
        if (where.purchasedOn === null) {
          return Promise.resolve(sum(undated, undatedBooks));
        }
        if (where.purchasedOn !== undefined) {
          return Promise.resolve(sum(thisMonth));
        }
        return Promise.resolve(sum(total));
      },
    );
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
        BudgetModule,
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
    prisma.settings.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([]);
    spending({});
  });

  const session = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  const as = (method: "get", url: string) =>
    request(app.getHttpServer())[method](url).set("Cookie", session());

  /** Every `where` the summary handed to Prisma, in no particular order. */
  const wheres = (): Record<string, unknown>[] =>
    prisma.book.aggregate.mock.calls.map(
      (call) => (call[0] as { where: Record<string, unknown> }).where,
    );

  describe("isolation (S0.3)", () => {
    it("refuses both routes without a session", async () => {
      const server = request(app.getHttpServer());

      await server.get("/budget/summary").expect(401);
      await server.get("/budget/by-month").expect(401);
    });

    it("scopes every aggregate to the session's user", async () => {
      await as("get", "/budget/summary").expect(200);

      expect(wheres().length).toBeGreaterThan(0);
      for (const where of wheres()) {
        expect(where).toMatchObject({ userId: "user-1" });
      }
    });

    it("binds the user id as a parameter in the raw query, never as text", async () => {
      await as("get", "/budget/by-month").expect(200);

      // A tagged template reaches Prisma as (strings, ...values); the id has
      // to be among the values, which is what makes it a bound parameter.
      const [, ...values] = prisma.$queryRaw.mock.calls[0];
      expect(values).toContain("user-1");
    });
  });

  describe("GET /budget/summary — the total (S6.1)", () => {
    it("sums what was paid, and only that", async () => {
      spending({ total: "340.50" });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.total).toBe(340.5);
      // §D6 — the wishlist's estimate is a guess about an unbought book and
      // never enters the budget, so no aggregate may so much as mention it.
      for (const where of wheres()) {
        expect(where).toMatchObject({ paidPrice: { not: null } });
        expect(where).not.toHaveProperty("estimatedPrice");
      }
    });

    it("answers 0 for a library nobody has spent anything on", async () => {
      // SUM over no rows is NULL; nothing bought cost nothing, not "unknown".
      spending({ total: null });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.total).toBe(0);
    });

    it("counts money with no purchase date in the total all the same", async () => {
      spending({ total: "100.00", thisMonth: "0.00", undated: "100.00", undatedBooks: 3 });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.total).toBe(100);
      expect(res.body.undated).toEqual({ books: 3, total: 100 });
    });
  });

  describe("GET /budget/summary — the month (S6.3)", () => {
    it("reports the current month, and asks for exactly its range", async () => {
      const month = currentMonth();
      const { start, next } = monthRange(month);

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.month.month).toBe(month);
      // Half-open, so February's length is never anybody's problem.
      expect(wheres()).toContainEqual({
        userId: "user-1",
        paidPrice: { not: null },
        purchasedOn: { gte: start, lt: next },
      });
    });

    it("subtracts the month's spending from the month's budget", async () => {
      spending({ total: "200.00", thisMonth: "59.90" });
      prisma.settings.findUnique.mockResolvedValue({
        userId: "user-1",
        monthlyBudget: decimal("120.00"),
      });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.month).toMatchObject({ spent: 59.9, budget: 120 });
      // 120 - 59.9 is 60.099999999999994 in binary floating point, and this
      // number goes on screen.
      expect(res.body.month.remaining).toBe(60.1);
    });

    it("goes negative when the month is overspent, rather than clamping at zero", async () => {
      spending({ thisMonth: "150.00" });
      prisma.settings.findUnique.mockResolvedValue({
        userId: "user-1",
        monthlyBudget: decimal("120.00"),
      });

      const res = await as("get", "/budget/summary").expect(200);

      // The sign is the warning S6.3 asks to show; zero would hide it.
      expect(res.body.month.remaining).toBe(-30);
    });

    it("leaves the budget null when none was ever set", async () => {
      spending({ thisMonth: "59.90" });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.month.budget).toBeNull();
      expect(res.body.month.remaining).toBeNull();
      // The spending is still worth knowing without a limit to compare it to.
      expect(res.body.month.spent).toBe(59.9);
    });

    it("starts the month from the whole budget, with nothing carried over (§D9)", async () => {
      // Last month's underspend is not this month's business: the only inputs
      // are the budget and what was spent inside the current range.
      spending({ total: "1000.00", thisMonth: "20.00" });
      prisma.settings.findUnique.mockResolvedValue({
        userId: "user-1",
        monthlyBudget: decimal("120.00"),
      });

      const res = await as("get", "/budget/summary").expect(200);

      expect(res.body.month.remaining).toBe(100);
    });
  });

  describe("GET /budget/by-month (S6.2)", () => {
    /**
     * `byMonth` runs two raw queries — the monthly totals and the ranked
     * purchases behind the tooltip — so the stub answers by *which* statement
     * it was handed rather than by call order, for the same reason `spending`
     * above does: they are issued inside one `Promise.all`.
     */
    const raw = ({
      totals = [] as unknown[],
      top = [] as unknown[],
    }: {
      totals?: unknown[];
      top?: unknown[];
    }) => {
      prisma.$queryRaw.mockImplementation((strings: string[]) =>
        Promise.resolve(strings.join(" ").includes("ROW_NUMBER") ? top : totals),
      );
    };

    it("groups by month, oldest first, filling the empty ones", async () => {
      raw({
        totals: [
          { month: "2026-01", total: decimal("120.00"), books: 1n },
          { month: "2026-03", total: decimal("60.00"), books: 1n },
        ],
      });

      const res = await as("get", "/budget/by-month").expect(200);

      expect(res.body.months.slice(0, 3)).toEqual([
        { month: "2026-01", spent: 120, top: [], others: 1 },
        { month: "2026-02", spent: 0, top: [], others: 0 },
        { month: "2026-03", spent: 60, top: [], others: 1 },
      ]);
    });

    it("reads a SUM that arrived as a string from the driver", async () => {
      raw({ totals: [{ month: "2026-01", total: "120.00", books: 1n }] });

      const res = await as("get", "/budget/by-month").expect(200);

      expect(res.body.months[0].spent).toBe(120);
    });

    it("returns an empty series when nothing dated was ever bought", async () => {
      raw({});

      const res = await as("get", "/budget/by-month").expect(200);

      // Not one bar reading zero.
      expect(res.body.months).toEqual([]);
    });

    it("reports the books the chart cannot draw", async () => {
      spending({ undated: "75.00", undatedBooks: 2 });
      raw({ totals: [{ month: "2026-01", total: decimal("120.00"), books: 1n }] });

      const res = await as("get", "/budget/by-month").expect(200);

      // S6.2 asks for the difference to be visible, and a count alone leaves
      // the reader subtracting two totals by hand.
      expect(res.body.undated).toEqual({ books: 2, total: 75 });
    });

    it("excludes undated and unpaid books from the grouping itself", async () => {
      await as("get", "/budget/by-month").expect(200);

      const [strings] = prisma.$queryRaw.mock.calls[0] as [string[]];
      const sql = strings.join(" ");
      expect(sql).toContain("`paidPrice` IS NOT NULL");
      expect(sql).toContain("`purchasedOn` IS NOT NULL");
    });

    describe("the month's dearest purchases", () => {
      it("attaches them to the month they belong to, dearest first", async () => {
        raw({
          totals: [{ month: "2026-01", total: decimal("210.00"), books: 3n }],
          top: [
            { month: "2026-01", title: "Gödel, Escher, Bach", paidPrice: decimal("120.00") },
            { month: "2026-01", title: "Solaris", paidPrice: "60.00" },
            { month: "2026-01", title: "Maitreyi", paidPrice: decimal("30.00") },
          ],
        });

        const res = await as("get", "/budget/by-month").expect(200);

        expect(res.body.months[0].top).toEqual([
          { title: "Gödel, Escher, Bach", paidPrice: 120 },
          { title: "Solaris", paidPrice: 60 },
          { title: "Maitreyi", paidPrice: 30 },
        ]);
        expect(res.body.months[0].others).toBe(0);
      });

      it("counts the purchases it did not name", async () => {
        raw({
          totals: [{ month: "2026-01", total: decimal("400.00"), books: 7n }],
          top: [
            { month: "2026-01", title: "A", paidPrice: decimal("100.00") },
            { month: "2026-01", title: "B", paidPrice: decimal("90.00") },
            { month: "2026-01", title: "C", paidPrice: decimal("80.00") },
          ],
        });

        const res = await as("get", "/budget/by-month").expect(200);

        // Seven bought, three named — the tooltip has to be able to say so
        // rather than implying three was all of it.
        expect(res.body.months[0].others).toBe(4);
      });

      it("leaves an invented empty month with nothing to name", async () => {
        raw({
          totals: [
            { month: "2026-01", total: decimal("120.00"), books: 1n },
            { month: "2026-03", total: decimal("60.00"), books: 1n },
          ],
          top: [{ month: "2026-01", title: "Solaris", paidPrice: decimal("120.00") }],
        });

        const res = await as("get", "/budget/by-month").expect(200);

        // February is a real zero `denseMonths` filled in; it held no purchases,
        // so neither list nor count may claim otherwise.
        expect(res.body.months[1]).toEqual({
          month: "2026-02",
          spent: 0,
          top: [],
          others: 0,
        });
      });

      it("ranks inside the database, scoped to the session's user", async () => {
        await as("get", "/budget/by-month").expect(200);

        const ranked = prisma.$queryRaw.mock.calls.find(([strings]) =>
          (strings as string[]).join(" ").includes("ROW_NUMBER"),
        );

        expect(ranked).toBeDefined();
        const [strings, ...params] = ranked as [string[], ...unknown[]];
        // S0.3 — the user id reaches MariaDB as a bound parameter, never as
        // text spliced into the statement.
        expect(strings.join(" ")).toContain("PARTITION BY");
        expect(params).toContain(storedUser.id);
      });
    });
  });
});
