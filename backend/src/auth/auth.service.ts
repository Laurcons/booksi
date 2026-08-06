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

  signSessionToken(user: Pick<User, "id">): string {
    const payload: SessionPayload = { sub: user.id };
    return this.jwt.sign(payload, { expiresIn: `${SESSION_TTL_DAYS}d` });
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
