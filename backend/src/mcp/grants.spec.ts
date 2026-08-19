import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerModule, minutes, seconds } from "@nestjs/throttler";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { McpModule } from "./mcp.module";

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

class FakePrisma {
  grants = new Map<string, any>();
  private seq = 0;

  $connect = jest.fn();
  auditLog = { create: jest.fn().mockResolvedValue(undefined) };
  user = { findUnique: jest.fn() };

  mcpGrant = {
    findMany: async ({ where }: any) => {
      return [...this.grants.values()]
        .filter((g) => g.userId === where.userId && (where.revokedAt === null ? g.revokedAt === null : true))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const g of this.grants.values()) {
        if (
          g.id === where.id &&
          g.userId === where.userId &&
          (where.revokedAt === null ? g.revokedAt === null : true)
        ) {
          Object.assign(g, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  seedGrant(overrides: Partial<Record<string, unknown>> = {}) {
    const grant = {
      id: `grant-${++this.seq}`,
      userId: "user-1",
      clientId: "dev-mcp-client",
      scope: "library",
      label: null,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
      ...overrides,
    };
    this.grants.set(grant.id, grant);
    return grant;
  }

  reset(): void {
    this.grants.clear();
  }
}

describe("MCP connected-apps screen (docs/MCP.md §9 step 6)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let prisma: FakePrisma;

  beforeAll(async () => {
    prisma = new FakePrisma();

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
              API_ORIGIN: "http://localhost:3000",
              MCP_CLIENT_ID: "test-mcp-client",
              MCP_CLIENT_SECRET: "test-mcp-secret",
              MCP_REDIRECT_URIS: "http://127.0.0.1:8765/callback",
              MCP_CLIENT_DISPLAY_NAME: "Test client",
            }),
          ],
        }),
        ThrottlerModule.forRoot({
          throttlers: [
            { name: "short", ttl: seconds(1), limit: 25 },
            { name: "long", ttl: minutes(1), limit: 300 },
          ],
        }),
        PrismaModule,
        AuditModule,
        AuthModule,
        McpModule,
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
    prisma.reset();
    prisma.user.findUnique.mockResolvedValue(storedUser);
  });

  const session = () => `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  describe("GET /mcp/grants", () => {
    it("requires a session", async () => {
      await request(app.getHttpServer()).get("/mcp/grants").expect(401);
    });

    it("lists the caller's non-revoked grants, with the configured client name", async () => {
      prisma.seedGrant({ id: "grant-a", lastUsedAt: new Date("2026-08-01T00:00:00Z") });
      prisma.seedGrant({ id: "grant-b", userId: "someone-else" });
      prisma.seedGrant({ id: "grant-c", revokedAt: new Date() });

      const res = await request(app.getHttpServer())
        .get("/mcp/grants")
        .set("Cookie", session())
        .expect(200);

      expect(res.body).toEqual([
        {
          id: "grant-a",
          clientId: "dev-mcp-client",
          clientName: "Test client",
          scope: "library",
          label: null,
          createdAt: expect.any(String),
          lastUsedAt: "2026-08-01T00:00:00.000Z",
        },
      ]);
    });
  });

  describe("POST /mcp/grants/:id/revoke", () => {
    it("requires a session", async () => {
      await request(app.getHttpServer()).post("/mcp/grants/grant-a/revoke").expect(401);
    });

    it("revokes the caller's own grant", async () => {
      const grant = prisma.seedGrant();

      await request(app.getHttpServer())
        .post(`/mcp/grants/${grant.id}/revoke`)
        .set("Cookie", session())
        .expect(204);

      expect(grant.revokedAt).not.toBeNull();
    });

    it("answers 404 — not 403 — for someone else's grant (S0.3)", async () => {
      const grant = prisma.seedGrant({ userId: "someone-else" });

      await request(app.getHttpServer())
        .post(`/mcp/grants/${grant.id}/revoke`)
        .set("Cookie", session())
        .expect(404);

      expect(grant.revokedAt).toBeNull();
    });

    it("answers 404 for a grant that does not exist", async () => {
      await request(app.getHttpServer())
        .post("/mcp/grants/never-existed/revoke")
        .set("Cookie", session())
        .expect(404);
    });

    it("is idempotent-safe: revoking an already-revoked grant 404s rather than double-firing", async () => {
      const grant = prisma.seedGrant({ revokedAt: new Date("2020-01-01T00:00:00Z") });

      await request(app.getHttpServer())
        .post(`/mcp/grants/${grant.id}/revoke`)
        .set("Cookie", session())
        .expect(404);
    });
  });
});
