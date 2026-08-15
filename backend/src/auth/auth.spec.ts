import { Controller, Get, INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
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
  tokenVersion: 0,
  isAdmin: false,
};

const adminUser = {
  ...storedUser,
  id: "admin-1",
  googleId: "google-admin",
  email: "admin@example.com",
  isAdmin: true,
};

const targetUser = {
  ...storedUser,
  id: "user-2",
  googleId: "google-2",
  email: "target@example.com",
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
  let jwtService: JwtService;
  const prisma = {
    $connect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
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
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(storedUser);
    prisma.user.update.mockResolvedValue(storedUser);
  });

  const sessionCookie = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

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
        isAdmin: false,
        impersonatedBy: null,
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

    /**
     * The point of S0.2's logout. Clearing the cookie takes away the browser's
     * copy and nothing else — the token is signed and self-contained, so
     * anything that captured it beforehand would keep working for the full 30
     * days. Bumping the version is what actually ends the session.
     */
    it("revokes the token rather than only clearing the cookie", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Cookie", sessionCookie())
        .expect(204);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: storedUser.id },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    it("leaves a token issued before the logout unusable", async () => {
      const captured = sessionCookie();

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Cookie", captured)
        .expect(204);

      // What the next request would read out of the database.
      prisma.user.findUnique.mockResolvedValue({
        ...storedUser,
        tokenVersion: 1,
      });

      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", captured)
        .expect(401);
    });

    it("does not fall over when there is no valid token to revoke", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Cookie", `${SESSION_COOKIE}=not.a.valid.jwt`)
        .expect(204);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  /** §D38 — the admin "log in as" feature. */
  describe("impersonation (§D38)", () => {
    const findUniqueById = (users: Record<string, typeof storedUser>) =>
      jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(users[where.id] ?? null),
      );

    const cookieFor = (
      user: typeof storedUser,
      impersonator?: { id: string; email: string },
    ) => `${SESSION_COOKIE}=${authService.signSessionToken(user, impersonator)}`;

    const tokenFromSetCookie = (res: request.Response) => {
      const setCookie = res.headers["set-cookie"] as unknown as string[];
      return setCookie[0].split(";")[0].split("=")[1];
    };

    describe("POST /auth/impersonate/:userId", () => {
      it("403s for a non-admin", async () => {
        prisma.user.findUnique.mockResolvedValue(storedUser);

        await request(app.getHttpServer())
          .post(`/auth/impersonate/${targetUser.id}`)
          .set("Cookie", cookieFor(storedUser))
          .expect(403);
      });

      it("400s on self-impersonation", async () => {
        prisma.user.findUnique.mockResolvedValue(adminUser);

        await request(app.getHttpServer())
          .post(`/auth/impersonate/${adminUser.id}`)
          .set("Cookie", cookieFor(adminUser))
          .expect(400);
      });

      it("404s for a target that does not exist", async () => {
        prisma.user.findUnique = findUniqueById({ [adminUser.id]: adminUser });

        await request(app.getHttpServer())
          .post("/auth/impersonate/does-not-exist")
          .set("Cookie", cookieFor(adminUser))
          .expect(404);
      });

      it("signs a cookie for the target, carrying the admin's identity", async () => {
        prisma.user.findUnique = findUniqueById({
          [adminUser.id]: adminUser,
          [targetUser.id]: targetUser,
        });

        const res = await request(app.getHttpServer())
          .post(`/auth/impersonate/${targetUser.id}`)
          .set("Cookie", cookieFor(adminUser))
          .expect(204);

        const payload = jwtService.verify(tokenFromSetCookie(res));
        expect(payload).toMatchObject({
          sub: targetUser.id,
          impersonatorId: adminUser.id,
          impersonatorEmail: adminUser.email,
        });
      });
    });

    describe("POST /auth/stop-impersonating", () => {
      it("400s when the session is not an impersonation", async () => {
        prisma.user.findUnique.mockResolvedValue(storedUser);

        await request(app.getHttpServer())
          .post("/auth/stop-impersonating")
          .set("Cookie", cookieFor(storedUser))
          .expect(400);
      });

      it("restores the admin's own session", async () => {
        prisma.user.findUnique = findUniqueById({
          [adminUser.id]: adminUser,
          [targetUser.id]: targetUser,
        });

        const res = await request(app.getHttpServer())
          .post("/auth/stop-impersonating")
          .set(
            "Cookie",
            cookieFor(targetUser, { id: adminUser.id, email: adminUser.email }),
          )
          .expect(204);

        const payload = jwtService.verify(tokenFromSetCookie(res));
        expect(payload).toMatchObject({ sub: adminUser.id });
        expect(payload).not.toHaveProperty("impersonatorId");
      });
    });

    describe("GET /auth/admin/users", () => {
      it("403s for a non-admin", async () => {
        prisma.user.findUnique.mockResolvedValue(storedUser);

        await request(app.getHttpServer())
          .get("/auth/admin/users?q=target")
          .set("Cookie", cookieFor(storedUser))
          .expect(403);
      });

      it("searches by email, excluding the caller", async () => {
        prisma.user.findUnique.mockResolvedValue(adminUser);
        prisma.user.findMany.mockResolvedValue([targetUser]);

        const res = await request(app.getHttpServer())
          .get("/auth/admin/users?q=target")
          .set("Cookie", cookieFor(adminUser))
          .expect(200);

        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              email: { contains: "target" },
              id: { not: adminUser.id },
            }),
          }),
        );
        expect(res.body).toEqual([
          {
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            avatarUrl: targetUser.avatarUrl,
          },
        ]);
      });
    });
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

    /**
     * The anti-CSRF nonce. Without it the callback accepts any authorization
     * code that reaches it, and a victim can be silently signed in as the
     * attacker — see `oauth-state.ts`. The value Google is asked to hand back
     * has to be the same one parked in the cookie, or there is nothing to
     * compare on the way in.
     */
    it("mints a state nonce and sends the same value to Google", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/google")
        .expect(302);

      const setCookie = res.headers["set-cookie"] as unknown as string[];
      const state = /oauth_state=([^;]+)/.exec(setCookie[0])?.[1];

      expect(state).toBeTruthy();
      expect(setCookie[0]).toContain("HttpOnly");
      expect(setCookie[0]).toContain("Path=/auth");
      expect(res.headers.location).toContain(`state=${state}`);
    });
  });

  describe("GET /auth/google/callback", () => {
    /**
     * A forged callback — the attacker's code, the victim's browser, no cookie
     * from this site. It has to be refused *before* the code is exchanged, so
     * no assertion here should require a network round trip to Google.
     */
    it("refuses a callback with no state cookie", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/google/callback?code=stolen&state=guessed")
        .expect(302);

      expect(res.headers.location).toBe("http://localhost:5173/login?error=auth");
    });

    it("refuses a callback whose state does not match the cookie", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/google/callback?code=stolen&state=guessed")
        .set("Cookie", "oauth_state=the-real-one")
        .expect(302);

      expect(res.headers.location).toBe("http://localhost:5173/login?error=auth");
    });

    /** Single use: the cookie is cleared whether or not the check passed. */
    it("clears the state cookie so it cannot be replayed", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/google/callback?code=stolen&state=the-real-one")
        .set("Cookie", "oauth_state=the-real-one")
        .expect(302);

      const setCookie = res.headers["set-cookie"] as unknown as string[];
      expect(setCookie.some((c) => c.startsWith("oauth_state=;"))).toBe(true);
    });
  });
});

describe("AuthService", () => {
  it("creates the account on first login and refreshes it afterwards (S0.1)", async () => {
    const prisma = {
      user: { upsert: jest.fn().mockResolvedValue(storedUser) },
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      { sign: () => "token" } as never,
      { get: () => undefined } as never,
    );

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
      isAdmin: false,
      impersonatedBy: null,
    });
  });
});
