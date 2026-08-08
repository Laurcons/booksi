import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PAIRING_TTL_MINUTES,
  type ConsumePairingResponse,
  type CreatePairingResponse,
  type PairingStatusResponse,
} from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { generatePairingCode } from "./pairing-code";

/** However unlikely a collision on a 32^6 alphabet is, a loop beats a crash. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * One message for every way a code or id can fail to resolve to something
 * usable — wrong, expired, or already spent. The device-facing pages never
 * show the API's words anyway (kobo-frontend renders its own fallback), and
 * the browser side only ever has a code a person just typed, for which
 * "wrong" and "expired" call for the same next action: look at the Kobo again.
 */
const INVALID_MESSAGE =
  "Codul nu e valid sau a expirat. Ia un cod nou de pe dispozitiv.";

@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** The Kobo's half of the flow: mint a code and hold it as `PENDING`. */
  async create(): Promise<CreatePairingResponse> {
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60_000);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = generatePairingCode();

      try {
        const row = await this.prisma.devicePairing.create({
          data: { code, expiresAt },
          select: { id: true, code: true, expiresAt: true },
        });

        return {
          id: row.id,
          code: row.code,
          expiresAt: row.expiresAt.toISOString(),
        };
      } catch (error) {
        if (!isUniqueCodeCollision(error)) {
          throw error;
        }
        // Collision on `code` — try again with a freshly drawn one.
      }
    }

    // Unreachable at this alphabet's size without a broken RNG, and not a
    // sentence anyone reads: the global filter turns this into a bare 500.
    throw new Error("Could not allocate a unique pairing code.");
  }

  /**
   * Polled by the Kobo's own waiting page, which has nothing else to check
   * with — there is no JavaScript to hold a socket open. The code rides
   * along so that page can keep displaying it without a second cookie; see
   * `pairingStatusResponseSchema`'s comment for why that is safe here.
   */
  async status(id: string): Promise<PairingStatusResponse> {
    const row = await this.prisma.devicePairing.findUnique({
      where: { id },
      select: { code: true, status: true, expiresAt: true },
    });

    if (!row) {
      throw AppError.pairingInvalid(INVALID_MESSAGE);
    }

    return { status: deriveStatus(row), code: row.code };
  }

  /**
   * The browser's half: a signed-in reader types the code the Kobo is
   * showing. Whichever account approves is the account the device signs in
   * as — the same trust boundary a TV-pairing code has everywhere else, and
   * why the code is short-lived and single-use rather than a standing PIN.
   */
  async approve(code: string, userId: string): Promise<void> {
    const row = await this.prisma.devicePairing.findUnique({
      where: { code },
      select: { id: true, status: true, expiresAt: true },
    });

    if (!row || deriveStatus(row) !== "pending") {
      throw AppError.pairingInvalid(INVALID_MESSAGE);
    }

    await this.prisma.devicePairing.update({
      where: { id: row.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: userId,
      },
    });
  }

  /**
   * The Kobo's last step, reached from a tap on "Am aprobat, continuă"
   * (§Autentificare). Single-use: once this returns a token the row is
   * `CONSUMED`, so a stale cookie replaying this call does not keep minting
   * sessions for whoever approved it.
   */
  async consume(id: string): Promise<ConsumePairingResponse> {
    const row = await this.prisma.devicePairing.findUnique({
      where: { id },
      select: { status: true, expiresAt: true, approvedByUserId: true },
    });

    if (!row || deriveStatus(row) !== "approved" || !row.approvedByUserId) {
      throw AppError.pairingInvalid(INVALID_MESSAGE);
    }

    const user = await this.authService.findById(row.approvedByUserId);

    if (!user) {
      // The approving account was deleted between approval and this tap.
      throw AppError.pairingInvalid(INVALID_MESSAGE);
    }

    await this.prisma.devicePairing.update({
      where: { id },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });

    return { token: this.authService.signSessionToken(user) };
  }
}

function deriveStatus(row: {
  status: "PENDING" | "APPROVED" | "CONSUMED";
  expiresAt: Date;
}): "pending" | "approved" | "consumed" | "expired" {
  if (row.status === "CONSUMED") {
    return "consumed";
  }

  // Expiry is read at the moment it is asked about, not swept by a job — see
  // the schema comment on `DevicePairing`. A `PENDING` or `APPROVED` row past
  // its time reads as `expired` either way, which is what stops an approved
  // but never-consumed code from being redeemable indefinitely.
  if (Date.now() > row.expiresAt.getTime()) {
    return "expired";
  }

  return row.status === "APPROVED" ? "approved" : "pending";
}

function isUniqueCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.["target"] as string[] | undefined)?.includes("code") === true
  );
}
