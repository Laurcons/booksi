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
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { pkceChallengeFromVerifier } from "./token-hash";
import { McpModule } from "./mcp.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

const CLIENT_ID = "test-mcp-client";
const CLIENT_SECRET = "test-mcp-secret";
const REDIRECT_URI = "http://127.0.0.1:8765/callback";
const RESOURCE = "http://localhost:3000/mcp";

/**
 * A minimal in-memory stand-in for the three MCP tables, exercised through
 * the exact call shapes `OAuthService` makes. `books.spec.ts`'s style is a
 * hand-rolled object of `jest.fn()`s per field, which works for a single
 * table with independent rows — this flow's correctness is entirely about
 * *relations* (a code belonging to a grant, a token replacing another), so a
 * tiny relational fake buys real coverage that mocking each call in
 * isolation would not.
 */
class FakePrisma {
  grants = new Map<string, any>();
  authCodes = new Map<string, any>();
  tokens = new Map<string, any>();
  private seq = 0;
  private nextId(prefix: string): string {
    return `${prefix}-${++this.seq}`;
  }

  $connect = jest.fn();
  user = { findUnique: jest.fn() };

  mcpGrant = {
    findFirst: async ({ where }: any) => {
      for (const g of this.grants.values()) {
        if (
          g.userId === where.userId &&
          g.clientId === where.clientId &&
          (where.revokedAt === null ? g.revokedAt === null : true)
        ) {
          return { ...g };
        }
      }
      return null;
    },
    create: async ({ data }: any) => {
      const grant = {
        id: this.nextId("grant"),
        label: null,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        ...data,
      };
      this.grants.set(grant.id, grant);
      return { ...grant };
    },
    update: async ({ where, data }: any) => {
      const grant = this.grants.get(where.id);
      if (!grant) throw new Error("grant not found");
      Object.assign(grant, data);
      return { ...grant };
    },
  };

  mcpAuthCode = {
    create: async ({ data }: any) => {
      const code = { id: this.nextId("code"), usedAt: null, ...data };
      this.authCodes.set(code.id, code);
      return { ...code };
    },
    findUnique: async ({ where, include }: any) => {
      const code = [...this.authCodes.values()].find((c) => c.codeHash === where.codeHash);
      if (!code) return null;
      const grant = this.grants.get(code.grantId);
      return include?.grant ? { ...code, grant: { ...grant } } : { ...code };
    },
    update: async ({ where, data }: any) => {
      const code = this.authCodes.get(where.id);
      if (!code) throw new Error("code not found");
      Object.assign(code, data);
      return { ...code };
    },
  };

  mcpToken = {
    create: async ({ data }: any) => {
      const token = {
        id: this.nextId("token"),
        replacedById: null,
        createdAt: new Date(),
        ...data,
      };
      this.tokens.set(token.id, token);
      return { ...token };
    },
    findUnique: async ({ where, include }: any) => {
      const token = [...this.tokens.values()].find((t) => t.tokenHash === where.tokenHash);
      if (!token) return null;
      const grant = this.grants.get(token.grantId);
      return include?.grant ? { ...token, grant: { ...grant } } : { ...token };
    },
    update: async ({ where, data }: any) => {
      const token = this.tokens.get(where.id);
      if (!token) throw new Error("token not found");
      Object.assign(token, data);
      return { ...token };
    },
  };

  $transaction = async (callback: (tx: this) => Promise<unknown>) => callback(this);

  reset(): void {
    this.grants.clear();
    this.authCodes.clear();
    this.tokens.clear();
  }
}

describe("MCP OAuth authorization server (docs/MCP.md §9 step 3)", () => {
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
              MCP_CLIENT_ID: CLIENT_ID,
              MCP_CLIENT_SECRET: CLIENT_SECRET,
              MCP_REDIRECT_URIS: REDIRECT_URI,
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

  /** A fresh PKCE pair, S256. */
  const pkce = () => {
    const verifier = "a".repeat(64);
    return { verifier, challenge: pkceChallengeFromVerifier(verifier) };
  };

  const authorizeParams = (overrides: Record<string, string> = {}) => {
    const { challenge } = pkce();
    return new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: RESOURCE,
      state: "xyz",
      ...overrides,
    });
  };

  /** Drives authorize → consent → approve, returning the code + verifier. */
  const obtainAuthorizationCode = async (): Promise<{ code: string; verifier: string; state: string }> => {
    const { verifier, challenge } = pkce();
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: RESOURCE,
      state: "round-trip-state",
    });

    const authorizeRes = await request(app.getHttpServer())
      .get(`/oauth/authorize?${params.toString()}`)
      .expect(302);

    const consentUrl = new URL(authorizeRes.headers.location);
    expect(consentUrl.pathname).toBe("/mcp/consent");
    const req = consentUrl.searchParams.get("req")!;

    const approveRes = await request(app.getHttpServer())
      .post(`/oauth/authorize/${req}/approve`)
      .set("Cookie", session())
      .expect(201);

    const redirectUrl = new URL(approveRes.body.redirectUrl);
    return {
      code: redirectUrl.searchParams.get("code")!,
      verifier,
      state: redirectUrl.searchParams.get("state")!,
    };
  };

  describe("GET /oauth/authorize", () => {
    it("redirects to the consent screen for a valid request", async () => {
      const res = await request(app.getHttpServer())
        .get(`/oauth/authorize?${authorizeParams().toString()}`)
        .expect(302);

      const location = new URL(res.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe("http://localhost:5173/mcp/consent");
      expect(location.searchParams.get("req")).toBeTruthy();
    });

    it("refuses an unknown client_id without redirecting anywhere", async () => {
      const res = await request(app.getHttpServer())
        .get(`/oauth/authorize?${authorizeParams({ client_id: "someone-else" }).toString()}`)
        .expect(400);

      expect(res.headers.location).toBeUndefined();
    });

    it("refuses a redirect_uri that is not on the allow-list, without redirecting there", async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/oauth/authorize?${authorizeParams({ redirect_uri: "https://evil.example/callback" }).toString()}`,
        )
        .expect(400);

      expect(res.headers.location).toBeUndefined();
    });

    it("bounces a malformed-but-known-client request back to redirect_uri with an error", async () => {
      const res = await request(app.getHttpServer())
        .get(`/oauth/authorize?${authorizeParams({ code_challenge_method: "plain" }).toString()}`)
        .expect(302);

      const location = new URL(res.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
      expect(location.searchParams.get("error")).toBe("invalid_request");
      expect(location.searchParams.get("state")).toBe("xyz");
    });
  });

  describe("GET /oauth/authorize/:req", () => {
    it("requires a session", async () => {
      const params = authorizeParams();
      const authorizeRes = await request(app.getHttpServer())
        .get(`/oauth/authorize?${params.toString()}`)
        .expect(302);
      const req = new URL(authorizeRes.headers.location).searchParams.get("req")!;

      await request(app.getHttpServer()).get(`/oauth/authorize/${req}`).expect(401);
    });

    it("returns the client name, scope, and redirect target for a signed-in user", async () => {
      const authorizeRes = await request(app.getHttpServer())
        .get(`/oauth/authorize?${authorizeParams().toString()}`)
        .expect(302);
      const req = new URL(authorizeRes.headers.location).searchParams.get("req")!;

      const res = await request(app.getHttpServer())
        .get(`/oauth/authorize/${req}`)
        .set("Cookie", session())
        .expect(200);

      expect(res.body).toEqual({
        clientName: "Test client",
        scope: "library",
        redirectUri: REDIRECT_URI,
        state: "xyz",
      });
    });

    it("rejects a garbage req with a user-actionable error", async () => {
      const res = await request(app.getHttpServer())
        .get("/oauth/authorize/not-a-real-token")
        .set("Cookie", session())
        .expect(400);

      expect(res.body.code).toBe("MCP_CONSENT_REQUEST_INVALID");
    });
  });

  describe("POST /oauth/authorize/:req/approve", () => {
    it("requires a session", async () => {
      const authorizeRes = await request(app.getHttpServer())
        .get(`/oauth/authorize?${authorizeParams().toString()}`)
        .expect(302);
      const req = new URL(authorizeRes.headers.location).searchParams.get("req")!;

      await request(app.getHttpServer()).post(`/oauth/authorize/${req}/approve`).expect(401);
    });

    it("reuses an existing non-revoked grant for the same user and client", async () => {
      await obtainAuthorizationCode();
      expect(prisma.grants.size).toBe(1);

      await obtainAuthorizationCode();
      expect(prisma.grants.size).toBe(1);
    });
  });

  describe("POST /oauth/token — authorization_code", () => {
    it("completes the full authorize → approve → token round trip", async () => {
      const { code, verifier, state } = await obtainAuthorizationCode();
      expect(state).toBe("round-trip-state");

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        token_type: "Bearer",
        expires_in: 3600,
        scope: "library",
      });
      expect(typeof res.body.access_token).toBe("string");
      expect(typeof res.body.refresh_token).toBe("string");
    });

    it("rejects the wrong code_verifier", async () => {
      const { code } = await obtainAuthorizationCode();

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: "b".repeat(64),
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });

    it("refuses a redirect_uri that does not match the one from /authorize", async () => {
      const { code, verifier } = await obtainAuthorizationCode();

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: "http://127.0.0.1:9999/other-callback",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });

    it("refuses the wrong client secret", async () => {
      const { code, verifier } = await obtainAuthorizationCode();

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: "wrong-secret",
        })
        .expect(401);

      expect(res.body.error).toBe("invalid_client");
    });

    it("is single-use — the same code cannot be redeemed twice", async () => {
      const { code, verifier } = await obtainAuthorizationCode();
      const payload = {
        grant_type: "authorization_code" as const,
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      };

      await request(app.getHttpServer()).post("/oauth/token").send(payload).expect(200);
      const res = await request(app.getHttpServer()).post("/oauth/token").send(payload).expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });

    it("refuses an expired code", async () => {
      const { code, verifier } = await obtainAuthorizationCode();
      const stored = [...prisma.authCodes.values()].find((c: any) => c.usedAt === null);
      stored.expiresAt = new Date(Date.now() - 1000);

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });
  });

  describe("POST /oauth/token — refresh_token", () => {
    const redeem = async () => {
      const { code, verifier } = await obtainAuthorizationCode();
      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);
      return res.body as { access_token: string; refresh_token: string };
    };

    it("rotates the refresh token on use", async () => {
      const first = await redeem();

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);

      expect(res.body.refresh_token).not.toBe(first.refresh_token);
      expect(res.body.access_token).not.toBe(first.access_token);
    });

    it("revokes the whole grant when a refresh token is presented twice", async () => {
      const first = await redeem();

      // First use: legitimate, rotates.
      await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);

      // Second use of the SAME (now stale) refresh token: reuse.
      const reuse = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(400);
      expect(reuse.body.error).toBe("invalid_grant");

      const grant = [...prisma.grants.values()][0];
      expect(grant.revokedAt).not.toBeNull();
    });

    it("refuses to refresh once the grant is revoked", async () => {
      const first = await redeem();
      const grant = [...prisma.grants.values()][0];
      grant.revokedAt = new Date();

      const res = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });
  });

  describe("POST /oauth/revoke", () => {
    it("revokes the grant behind a valid token", async () => {
      const { code, verifier } = await obtainAuthorizationCode();
      const tokenRes = await request(app.getHttpServer())
        .post("/oauth/token")
        .send({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({
          token: tokenRes.body.refresh_token,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        })
        .expect(200);

      const grant = [...prisma.grants.values()][0];
      expect(grant.revokedAt).not.toBeNull();
    });

    it("answers 200 for an unrecognized token, per RFC 7009", async () => {
      await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: "never-issued", client_id: CLIENT_ID, client_secret: CLIENT_SECRET })
        .expect(200);
    });

    it("refuses the wrong client credentials", async () => {
      const res = await request(app.getHttpServer())
        .post("/oauth/revoke")
        .send({ token: "irrelevant", client_id: CLIENT_ID, client_secret: "wrong" })
        .expect(401);

      expect(res.body.error).toBe("invalid_client");
    });
  });
});
