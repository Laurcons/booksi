import { Controller, Get, INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule, minutes, seconds } from "@nestjs/throttler";
import request from "supertest";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { AuditModule } from "../audit/audit.module";
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

  const prisma = { $connect: jest.fn(), auditLog: { create: jest.fn().mockResolvedValue(undefined) }, user: { findUnique: jest.fn() } };

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
        AuditModule,
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

    /**
     * `listen(0)` rather than `init()`, which is what every other suite here
     * uses. Supertest binds an ephemeral port itself when handed a server that
     * is not listening — fine for one request at a time, but the tests below
     * fire their attempts as a single burst (they have to; see the first one),
     * and six calls each trying to bind the same server tear each other's
     * sockets down with `ECONNRESET`. Listening once, up front, gives them all
     * one address to talk to.
     */
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * `LOGIN_RATE`'s burst window is 5 a second, and that is the one a script
   * actually meets — a burst of requests exhausts it long before the minute
   * ceiling of 15 comes into play. So six attempts inside one window is the
   * boundary worth pinning; asserting it, rather than "some request eventually
   * stops working", is what makes this fail if the constant is loosened.
   *
   * Both outcomes are a 302 — the route redirects to Google when it succeeds
   * (passport builds that URL locally, no network involved) and to the login
   * screen when `OAuthFailureFilter` catches the refusal — so the assertion has
   * to be on *where* it redirects, not on the status.
   *
   * **Fired together, not in a loop, and that is what makes this test stable.**
   * Sequentially it was a race against the very window it asserts about: five
   * round trips take 91ms when this file runs alone, but 982ms under the full
   * suite's parallel workers, each booting a Nest app of its own. At 982ms the
   * sixth request arrives after the 1000ms window has expired, the throttler's
   * record resets, and a request that *should* be refused is counted as the
   * first of a fresh window — a failure that says nothing about the limiter and
   * everything about how loaded the machine was.
   *
   * In one tick the window cannot expire mid-test. The storage still increments
   * atomically, so of six concurrent attempts exactly one crosses the limit.
   * What is given up is naming *which* one: the sixth to arrive is no longer
   * knowable, and it never needed to be — the constant under test is "five a
   * second", and "exactly one of six was refused" pins it just as tightly.
   */
  it("refuses a sixth login attempt in the same second (§1.4)", async () => {
    const server = app.getHttpServer();

    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => request(server).get("/auth/google")),
    );

    expect(attempts.map((res) => res.status)).toEqual(Array(6).fill(302));

    const locations = attempts.map((res) => res.headers.location);

    expect(
      locations.filter((to) => to === "http://localhost:5173/login?error=rate"),
    ).toHaveLength(1);
    expect(
      locations.filter((to) => to?.includes("accounts.google.com")),
    ).toHaveLength(5);
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

    // One burst, for the reason spelled out above: sequentially this outran the
    // window it was asserting about.
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => request(server).get("/auth/google/callback")),
    );

    const rated = attempts
      .map((res) => res.headers.location ?? "")
      .filter((to) => to.includes("error=rate"));

    expect(rated).toHaveLength(1);
    // The distinction this test exists for: the refused one says the limit was
    // hit, not that the sign-in itself failed. The other five *are* `error=auth`
    // — a callback with no code is a genuine passport failure — which is exactly
    // why the wrong wording hid here for so long.
    expect(rated[0]).not.toContain("error=auth");
  });

  /**
   * The tight login limit must not be the app's limit. A page load fires
   * several queries at once and every mutation refetches a few more, so a
   * ceiling of 15 anywhere near the books routes would break ordinary use —
   * which is exactly why `LOGIN_RATE` is applied per route and not globally.
   *
   * **Concurrent for a softer reason than the two above.** This one was not
   * flaky — a sequential loop of twenty does catch a tightened ceiling, as long
   * as the loop outruns the window. What it does not do is *say* how many
   * requests it measured: at 18ms a request all twenty land in one window and
   * the assertion means what it reads, while at 200ms they spread across four
   * windows that each reset, and the same passing test now only ever proves the
   * route serves five at a time. Fired together, "twenty inside one window" is
   * true by construction rather than by whatever the machine was doing.
   */
  it("leaves the app-wide ceiling far above the login one", async () => {
    const server = app.getHttpServer();

    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => request(server).get("/probe")),
    );

    expect(attempts.map((res) => res.status)).toEqual(Array(20).fill(200));
  });
});
