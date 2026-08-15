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
import { SettingsModule } from "./settings.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

/** The row as Prisma stores it — the two columns no story implements included. */
const storedSettings = {
  userId: "user-1",
  monthlyBudget: new Prisma.Decimal("120.00"),
  yearlyBudget: null,
  currency: "RON",
};

describe("settings routes (S6.3)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = {
    $connect: jest.fn(),
    auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    user: { findUnique: jest.fn() },
    settings: { findUnique: jest.fn(), upsert: jest.fn() },
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
        SettingsModule,
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

  const as = (method: "get" | "put", url: string) =>
    request(app.getHttpServer())[method](url).set("Cookie", session());

  describe("isolation (S0.3)", () => {
    it("refuses both routes without a session", async () => {
      const server = request(app.getHttpServer());

      await server.get("/settings").expect(401);
      await server.put("/settings").send({ monthlyBudget: 120 }).expect(401);
    });

    it("reads and writes the session's own row, never one named in the body", async () => {
      prisma.settings.upsert.mockResolvedValue(storedSettings);

      await as("put", "/settings")
        .send({ monthlyBudget: 120, userId: "someone-else" })
        .expect(400);

      prisma.settings.findUnique.mockResolvedValue(null);
      await as("get", "/settings").expect(200);

      expect(prisma.settings.findUnique.mock.calls[0][0].where).toEqual({
        userId: "user-1",
      });
    });
  });

  describe("GET /settings", () => {
    it("answers with no budget for an account that never saved one", async () => {
      // The row is created on first save, so its absence is the ordinary first
      // visit rather than a missing record.
      prisma.settings.findUnique.mockResolvedValue(null);

      const res = await as("get", "/settings").expect(200);

      expect(res.body).toEqual({ monthlyBudget: null });
    });

    it("returns the stored budget as a number", async () => {
      prisma.settings.findUnique.mockResolvedValue(storedSettings);

      const res = await as("get", "/settings").expect(200);

      // Decimal crosses the wire as a number, not as an object.
      expect(res.body).toEqual({ monthlyBudget: 120 });
    });

    it("keeps the columns no story implements out of the response (§D31)", async () => {
      prisma.settings.findUnique.mockResolvedValue(storedSettings);

      const res = await as("get", "/settings").expect(200);

      // `currency` (S6.4, dropped) and `yearlyBudget` exist in the table and
      // stay there; exposing them would advertise a setting nothing honours.
      expect(res.body.currency).toBeUndefined();
      expect(res.body.yearlyBudget).toBeUndefined();
    });
  });

  describe("PUT /settings", () => {
    beforeEach(() => {
      prisma.settings.upsert.mockResolvedValue(storedSettings);
    });

    it("creates the row on the first save and updates it afterwards", async () => {
      await as("put", "/settings").send({ monthlyBudget: 120 }).expect(200);

      const call = prisma.settings.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "user-1" });
      expect(call.create).toEqual({
        userId: "user-1",
        monthlyBudget: new Prisma.Decimal("120.00"),
      });
      expect(call.update).toEqual({
        monthlyBudget: new Prisma.Decimal("120.00"),
      });
    });

    it("stores the amount through its two-decimal string, not through the double", async () => {
      await as("put", "/settings").send({ monthlyBudget: 59.9 }).expect(200);

      expect(prisma.settings.upsert.mock.calls[0][0].update).toEqual({
        monthlyBudget: new Prisma.Decimal("59.90"),
      });
    });

    it("clears the budget when sent null — opting back out has to be reachable", async () => {
      prisma.settings.upsert.mockResolvedValue({
        ...storedSettings,
        monthlyBudget: null,
      });

      const res = await as("put", "/settings")
        .send({ monthlyBudget: null })
        .expect(200);

      expect(prisma.settings.upsert.mock.calls[0][0].update).toEqual({
        monthlyBudget: null,
      });
      expect(res.body).toEqual({ monthlyBudget: null });
    });

    it("requires the field, so a cleared budget cannot look like a forgotten one", async () => {
      await as("put", "/settings").send({}).expect(400);

      expect(prisma.settings.upsert).not.toHaveBeenCalled();
    });

    it("refuses a negative budget", async () => {
      await as("put", "/settings").send({ monthlyBudget: -10 }).expect(400);

      expect(prisma.settings.upsert).not.toHaveBeenCalled();
    });

    it("refuses a third decimal rather than letting MariaDB round it", async () => {
      const res = await as("put", "/settings")
        .send({ monthlyBudget: 12.345 })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining("monthlyBudget:")]),
      );
    });

    it("rejects the columns S6.4 would have written (§D31)", async () => {
      // Silently dropping them would look like the API accepted the setting.
      await as("put", "/settings")
        .send({ monthlyBudget: 120, currency: "EUR" })
        .expect(400);
      await as("put", "/settings")
        .send({ monthlyBudget: 120, yearlyBudget: 1200 })
        .expect(400);

      expect(prisma.settings.upsert).not.toHaveBeenCalled();
    });
  });
});
