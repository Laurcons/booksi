import { Controller, Get, INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "./auth.module";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE } from "./session";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: "https://example.com/a.png",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

/**
 * Stands in for a Sprint 1 controller: it carries no decorator at all, which
 * is exactly the point — it must still be unreachable without a session.
 */
@Controller("probe")
class ProbeController {
  @Get()
  get(): { ok: boolean } {
    return { ok: true };
  }
}

describe("auth routes", () => {
  let app: INestApplication;
  let authService: AuthService;
  const prisma = {
    $connect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
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
              GOOGLE_CALLBACK_URL:
                "http://localhost:3000/auth/google/callback",
              JWT_SECRET: "test-secret-long-enough",
              WEB_ORIGIN: "http://localhost:5173",
            }),
          ],
        }),
        PrismaModule,
        AuthModule,
      ],
      controllers: [ProbeController],
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

  const sessionCookie = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken({ id: storedUser.id })}`;

  describe("GET /auth/me", () => {
    it("answers 401 without a cookie, so the frontend can show login", () =>
      request(app.getHttpServer()).get("/auth/me").expect(401));

    it("answers 401 for a token signed with the wrong secret", () =>
      request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", `${SESSION_COOKIE}=not.a.valid.jwt`)
        .expect(401));

    it("returns the current user for a valid session", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", sessionCookie())
        .expect(200);

      expect(res.body).toEqual({
        id: "user-1",
        email: "cineva@example.com",
        name: "Cineva",
        avatarUrl: "https://example.com/a.png",
      });
      // googleId is a join key, not something the client ever needs.
      expect(res.body.googleId).toBeUndefined();
    });

    it("rejects a still-valid cookie of a deleted account", async () => {
      const cookie = sessionCookie();
      prisma.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", cookie)
        .expect(401);
    });
  });

  describe("global guard (S0.3)", () => {
    it("protects a route that asked for nothing", () =>
      request(app.getHttpServer()).get("/probe").expect(401));

    it("lets that same route through with a session", () =>
      request(app.getHttpServer())
        .get("/probe")
        .set("Cookie", sessionCookie())
        .expect(200, { ok: true }));
  });

  describe("POST /auth/logout", () => {
    it("clears the session cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Cookie", sessionCookie())
        .expect(204);

      const setCookie = res.headers["set-cookie"] as unknown as string[];
      expect(setCookie).toHaveLength(1);
      // Same attributes as when it was set, or the browser keeps the original.
      expect(setCookie[0]).toMatch(/^session=;/);
      expect(setCookie[0]).toContain("HttpOnly");
      expect(setCookie[0]).toContain("SameSite=Lax");
      expect(setCookie[0]).toContain("Path=/");
    });

    it("works without a session, so a stale tab can still log out", () =>
      request(app.getHttpServer()).post("/auth/logout").expect(204));
  });

  describe("GET /auth/google", () => {
    it("redirects the browser to Google", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/google")
        .expect(302);

      expect(res.headers.location).toContain(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      expect(res.headers.location).toContain("client_id=test-client-id");
    });
  });
});

describe("AuthService", () => {
  it("creates the account on first login and refreshes it afterwards (S0.1)", async () => {
    const prisma = {
      user: { upsert: jest.fn().mockResolvedValue(storedUser) },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, {
      sign: () => "token",
    } as never);

    await service.upsertFromGoogle({
      googleId: "google-1",
      email: "cineva@example.com",
      name: "Cineva",
      avatarUrl: null,
    });

    const call = (prisma.user.upsert as unknown as jest.Mock).mock.calls[0][0];
    // Keyed on the Google subject id: a Workspace address can be renamed.
    expect(call.where).toEqual({ googleId: "google-1" });
    expect(call.create.email).toBe("cineva@example.com");
    expect(call.update.email).toBe("cineva@example.com");
  });

  it("hides googleId and createdAt from the wire", () => {
    expect(AuthService.toAuthUser(storedUser)).toEqual({
      id: "user-1",
      email: "cineva@example.com",
      name: "Cineva",
      avatarUrl: "https://example.com/a.png",
    });
  });
});
