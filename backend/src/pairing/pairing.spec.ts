import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { ThrottlerModule, minutes, seconds } from "@nestjs/throttler";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { PairingModule } from "./pairing.module";

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
 * A minimal relational fake for the one table this slice touches, in the
 * style `mcp/oauth.spec.ts` settled on: real call shapes, an in-memory `Map`,
 * and — the one piece that matters here — a `code` uniqueness check that
 * throws the same shape of error Prisma's `create` would, so the retry loop
 * in `PairingService.create` is exercised for real rather than assumed.
 */
class FakePrisma {
  rows = new Map<string, any>();
  private seq = 0;

  $connect = jest.fn();
  user = { findUnique: jest.fn() };

  devicePairing = {
    create: async ({ data }: any) => {
      if ([...this.rows.values()].some((row) => row.code === data.code)) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
          meta: { target: ["code"] },
        });
      }

      const row = {
        id: `pairing-${++this.seq}`,
        status: "PENDING",
        approvedByUserId: null,
        approvedAt: null,
        consumedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.rows.set(row.id, row);
      return { ...row };
    },
    findUnique: async ({ where }: any) => {
      const row = where.id
        ? this.rows.get(where.id)
        : [...this.rows.values()].find((r) => r.code === where.code);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: any) => {
      const row = this.rows.get(where.id);
      if (!row) throw new Error("row not found");
      Object.assign(row, data);
      return { ...row };
    },
  };

  reset(): void {
    this.rows.clear();
    this.seq = 0;
  }
}

describe("pairing by code (§D37, docs/kobo_design.md §Autentificare)", () => {
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
        PairingModule,
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

  const createPairing = () => request(app.getHttpServer()).post("/pairing").expect(201);

  describe("POST /pairing", () => {
    it("mints a code from the ambiguity-free alphabet, with no session required", async () => {
      const res = await createPairing();

      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("retries when a freshly drawn code collides with one already pending", async () => {
      // Force the very next `create` to collide, regardless of which code is
      // drawn — the retry loop is what is under test, not the RNG.
      const originalCreate = prisma.devicePairing.create;
      let collided = false;
      prisma.devicePairing.create = (async (args: any) => {
        if (!collided) {
          collided = true;
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test",
            meta: { target: ["code"] },
          });
        }
        return originalCreate(args);
      }) as typeof originalCreate;

      const res = await createPairing();

      expect(collided).toBe(true);
      expect(res.body.code).toEqual(expect.any(String));
    });
  });

  describe("GET /pairing/:id", () => {
    it("reads back as pending right after creation", async () => {
      const created = await createPairing();

      const res = await request(app.getHttpServer())
        .get(`/pairing/${created.body.id}`)
        .expect(200);

      expect(res.body).toEqual({ status: "pending", code: created.body.code });
    });

    it("is PAIRING_INVALID for an id that does not exist", async () => {
      const res = await request(app.getHttpServer()).get("/pairing/nope").expect(400);

      expect(res.body.code).toBe("PAIRING_INVALID");
    });

    it("reports expired once past its ten minutes, even though nothing swept it", async () => {
      const created = await createPairing();
      const row = prisma.rows.get(created.body.id);
      row.expiresAt = new Date(Date.now() - 1000);

      const res = await request(app.getHttpServer())
        .get(`/pairing/${created.body.id}`)
        .expect(200);

      expect(res.body.status).toBe("expired");
    });
  });

  describe("POST /pairing/approve", () => {
    it("requires a session (S0.3's rule applies here too)", async () => {
      const created = await createPairing();

      await request(app.getHttpServer())
        .post("/pairing/approve")
        .send({ code: created.body.code })
        .expect(401);
    });

    it("moves a pending code to approved, tied to the approving account", async () => {
      const created = await createPairing();

      await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: created.body.code })
        .expect(204);

      const row = prisma.rows.get(created.body.id);
      expect(row.status).toBe("APPROVED");
      expect(row.approvedByUserId).toBe("user-1");
    });

    it("accepts the code typed with a stray space and lowercase letters", async () => {
      const created = await createPairing();
      const messy = created.body.code.toLowerCase().replace(/^(.{3})/, "$1 ");

      await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: messy })
        .expect(204);
    });

    it("refuses a code that does not exist", async () => {
      const res = await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: "ZZZZZZ" })
        .expect(400);

      expect(res.body.code).toBe("PAIRING_INVALID");
    });

    it("refuses a code that was already approved", async () => {
      const created = await createPairing();
      const approve = () =>
        request(app.getHttpServer())
          .post("/pairing/approve")
          .set("Cookie", session())
          .send({ code: created.body.code });

      await approve().expect(204);
      const res = await approve().expect(400);

      expect(res.body.code).toBe("PAIRING_INVALID");
    });
  });

  describe("POST /pairing/:id/consume", () => {
    it("refuses a code nobody has approved yet, with no session required", async () => {
      const created = await createPairing();

      const res = await request(app.getHttpServer())
        .post(`/pairing/${created.body.id}/consume`)
        .expect(400);

      expect(res.body.code).toBe("PAIRING_INVALID");
    });

    it("hands back a session token for the account that approved it", async () => {
      const created = await createPairing();
      await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: created.body.code })
        .expect(204);

      const res = await request(app.getHttpServer())
        .post(`/pairing/${created.body.id}/consume`)
        .expect(200);

      expect(res.body.token).toEqual(expect.any(String));

      // The token this endpoint minted is a real session, not a lookalike:
      // the same guard that protects every other route accepts it.
      const me = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", `${SESSION_COOKIE}=${res.body.token}`)
        .expect(200);
      expect(me.body.id).toBe("user-1");
    });

    it("is single-use — a second call on the same id is refused", async () => {
      const created = await createPairing();
      await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: created.body.code })
        .expect(204);

      await request(app.getHttpServer())
        .post(`/pairing/${created.body.id}/consume`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/pairing/${created.body.id}/consume`)
        .expect(400);
      expect(res.body.code).toBe("PAIRING_INVALID");
    });

    it("refuses an approved code once it has expired", async () => {
      const created = await createPairing();
      await request(app.getHttpServer())
        .post("/pairing/approve")
        .set("Cookie", session())
        .send({ code: created.body.code })
        .expect(204);

      prisma.rows.get(created.body.id).expiresAt = new Date(Date.now() - 1000);

      const res = await request(app.getHttpServer())
        .post(`/pairing/${created.body.id}/consume`)
        .expect(400);
      expect(res.body.code).toBe("PAIRING_INVALID");
    });
  });
});
