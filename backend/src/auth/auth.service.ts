import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import type { AuthUser } from "@bookcsi/shared";
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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * First login creates the account outright (S0.1) — there is no approval step
   * and no invitation. Later logins refresh the profile, since a user can
   * rename themselves or change their picture on Google's side.
   *
   * The key is `googleId`, not `email`: Google Workspace addresses can be
   * renamed while the subject id stays put.
   */
  async upsertFromGoogle(profile: GoogleProfileData): Promise<User> {
    return this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      update: {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  signSessionToken(user: Pick<User, "id" | "tokenVersion">): string {
    const payload: SessionPayload = { sub: user.id, ver: user.tokenVersion };
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
  static toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }
}
