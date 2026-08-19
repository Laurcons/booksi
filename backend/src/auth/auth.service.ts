import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import {
  DEFAULT_LOCALE,
  matchLocale,
  parseAcceptLanguage,
  localeSchema,
  type Locale,
  type AdminUserSummary,
  type AuthUser,
} from "@bookcsi/shared";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { SESSION_TTL_DAYS } from "./session";

/** What Google gives us that we care about. */
export interface GoogleProfileData {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface SessionPayload {
  sub: string;
  /**
   * The `tokenVersion` the user had when this token was signed. A token whose
   * version has fallen behind the stored one is refused — that is the whole of
   * the revocation mechanism (S0.2).
   *
   * Not optional, and deliberately so: a token predating this field has no
   * version to check, and treating "absent" as "current" would leave exactly
   * the tokens this exists to invalidate still working.
   */
  ver: number;
  /**
   * Set only while an admin is impersonating (§D38). `sub` above is already
   * the *target* user — every existing `@CurrentUser()` check keeps working
   * unmodified — so this pair exists purely to let the app show who is
   * driving the session and offer a way back, without a second database
   * lookup on every impersonated request.
   */
  impersonatorId?: string;
  impersonatorEmail?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * First login creates the account outright (S0.1) — there is no approval step
   * and no invitation. Later logins refresh the profile, since a user can
   * rename themselves or change their picture on Google's side. `isAdmin` is
   * refreshed the same way, off `ADMIN_EMAILS` (§D38): editing that variable
   * takes effect the next time the account signs in.
   *
   * The key is `googleId`, not `email`: Google Workspace addresses can be
   * renamed while the subject id stays put.
   *
   * `locale` appears on `create` and deliberately **not** on `update` (§D44).
   * The two halves answer different questions. A new account has expressed no
   * preference, so the device's is the best guess available and beats the
   * column's `"ro"` default — which exists for the rows that predate the
   * column, not for arrivals. An existing account *has* expressed one, by
   * either choosing it or leaving it, and signing in on a borrowed
   * English-language laptop is not a request to change it.
   */
  async upsertFromGoogle(
    profile: GoogleProfileData,
    acceptLanguage?: string,
  ): Promise<User> {
    const isAdmin = this.isAdminEmail(profile.email);

    return this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isAdmin,
        locale: matchLocale(parseAcceptLanguage(acceptLanguage)),
      },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isAdmin,
      },
    });
  }

  /**
   * S?/§D44 — the language switch. One column, so a whole-object write and a
   * patch are the same request.
   *
   * Returns the refreshed `AuthUser` rather than nothing, so the client can
   * settle on the server's answer instead of trusting its own optimistic one.
   */
  async setLocale(userId: string, locale: Locale): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale },
    });
  }

  private isAdminEmail(email: string): boolean {
    const adminEmails = this.config.get("ADMIN_EMAILS", { infer: true });
    if (!adminEmails) {
      return false;
    }
    const needle = email.toLowerCase();
    return adminEmails
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .includes(needle);
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Backs the admin "who do I impersonate" search (§D38). `contains` with no
   * `mode` — MySQL's default collation is already case-insensitive, unlike
   * Postgres, where this would need `mode: "insensitive"`.
   */
  async searchUsers(query: string, excludeUserId: string): Promise<AdminUserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: {
        email: { contains: query },
        id: { not: excludeUserId },
      },
      orderBy: { email: "asc" },
      take: 20,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }));
  }

  /**
   * `impersonator` set signs a token that authenticates *as* `user` while
   * carrying who started the session (§D38's `impersonatorId`/`Email`).
   * Omitted, this is an ordinary login/refresh token.
   */
  signSessionToken(
    user: Pick<User, "id" | "tokenVersion">,
    impersonator?: { id: string; email: string },
  ): string {
    const payload: SessionPayload = {
      sub: user.id,
      ver: user.tokenVersion,
      ...(impersonator && {
        impersonatorId: impersonator.id,
        impersonatorEmail: impersonator.email,
      }),
    };
    return this.jwt.sign(payload, { expiresIn: `${SESSION_TTL_DAYS}d` });
  }

  /**
   * S0.2 — what makes logging out mean something.
   *
   * Clearing the cookie removes the browser's copy of the session and nothing
   * else: the token is self-contained and stays valid for its full 30 days,
   * so anything that captured it beforehand still has an account. Bumping the
   * counter invalidates every token signed under the old value at once.
   *
   * That "at once" is the trade: one counter per user means logging out ends
   * the session on every device, not just this one. Per-device revocation
   * needs a table of live sessions, which is a real feature and not what S0.2
   * asks for — it asks for an explicit logout that works.
   *
   * Takes the raw token rather than a user id because logout is `@Public()`:
   * a tab whose session expired hours ago must still be able to leave, so the
   * route cannot demand the guard have already identified anybody. A token
   * that will not verify simply has nothing to revoke.
   */
  async revokeSessions(token: string | undefined | null): Promise<void> {
    if (!token) {
      return;
    }

    let payload: SessionPayload;

    try {
      payload = this.jwt.verify<SessionPayload>(token);
    } catch {
      // Expired, forged, or signed with an old secret. Logging out is still a
      // success from the caller's point of view — the cookie goes either way.
      return;
    }

    try {
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      // The account was deleted between signing and logging out. Its tokens
      // are already dead, since `validate` refuses a user that is not there.
    }
  }

  /** Strips `googleId` and `createdAt` — the client has no use for either. */
  static toAuthUser(
    user: User,
    impersonatedBy: { id: string; email: string } | null = null,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      // The column is a plain `String` (§D44 — the set of languages is a
      // property of the interface, not of the data), so a row written by an
      // older build, a fixture, or a hand-run SQL statement could hold anything.
      // Narrowed here rather than trusted, because this is the one place the row
      // becomes the `AuthUser` both ends type against.
      locale: localeSchema.catch(DEFAULT_LOCALE).parse(user.locale),
      impersonatedBy,
    };
  }
}
