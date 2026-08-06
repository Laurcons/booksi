import { Controller, Get, INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule, minutes, seconds } from "@nestjs/throttler";
import request from "supertest";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "./auth.module";

/**
 * Rate limiting is the kind of control that fails open: remove the guard, or
 * let a route drift out from under it, and every test still passes because
 * nothing was ever asserted about the request that should have been refused.
 *
 * So this file asserts the refusal itself. It mirrors `AppModule`'s wiring —
 * the same two windows, the same guard order — rather than importing it,
 * because `AppModule` reads a real `.env` and this suite must not.
 */
@Controller("probe")
class ProbeController {
  @Public()
  @Get()
  get(): { ok: boolean } {
    return { ok: true };
  }
}

describe("rate limiting", () => {
  let app: INestApplication;

  const prisma = { $connect: jest.fn(), user: { findUnique: jest.fn() } };

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
              TRUST_PROXY: 0,
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
        AuthModule,
      ],
      controllers: [ProbeController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * `LOGIN_RATE`'s burst window is 5 a second, and that is the one a script
   * actually meets — a loop of requests exhausts it long before the minute
   * ceiling of 15 comes into play. So the sixth consecutive attempt is the
   * boundary worth pinning; asserting it, rather than "some request eventually
   * stops working", is what makes this fail if the constant is loosened.
   *
   * Both outcomes are a 302 — the route redirects to Google when it succeeds
   * (passport builds that URL locally, no network involved) and to the login
   * screen when `OAuthFailureFilter` catches the refusal — so the assertion has
   * to be on *where* it redirects, not on the status.
   */
  it("refuses a sixth login attempt in the same second (§1.4)", async () => {
    const server = app.getHttpServer();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await request(server).get("/auth/google").expect(302);
      expect(res.headers.location).toContain("accounts.google.com");
    }

    const refused = await request(server).get("/auth/google").expect(302);
    expect(refused.headers.location).toBe(
      "http://localhost:5173/login?error=rate",
    );
  });

  /**
   * `OAuthFailureFilter` is `@Catch()`, so it sees the throttler's exception as
   * readily as passport's — and until this was noticed it turned every refusal
   * into `?error=auth`, telling a rate-limited visitor their sign-in had failed
   * and inviting them to try again. Wrong on both counts, and it hid the
   * limiter well enough that the first version of this suite concluded
   * throttling was not working at all.
   */
  it("does not report a rate limit as a failed sign-in", async () => {
    const server = app.getHttpServer();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(server).get("/auth/google/callback");
    }

    const refused = await request(server).get("/auth/google/callback");
    expect(refused.headers.location).toContain("error=rate");
    expect(refused.headers.location).not.toContain("error=auth");
  });

  /**
   * The tight login limit must not be the app's limit. A page load fires
   * several queries at once and every mutation refetches a few more, so a
   * ceiling of 15 anywhere near the books routes would break ordinary use —
   * which is exactly why `LOGIN_RATE` is applied per route and not globally.
   */
  it("leaves the app-wide ceiling far above the login one", async () => {
    const server = app.getHttpServer();

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await request(server).get("/probe").expect(200);
    }
  });
});
