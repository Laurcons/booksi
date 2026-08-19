import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { CoverSource } from "@prisma/client";
import { sniffCoverMimeType, type CoverRef } from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { ownedOrNotFound } from "../common/ownership";
import { OpenLibraryClient } from "../openlibrary/open-library.client";
import { PrismaService } from "../prisma/prisma.service";
import { coverUrl } from "./cover-url";

/** What `GET /covers/{bookId}` needs in order to answer. */
export type StoredCover = {
  data: Buffer;
  mimeType: string;
  version: Date;
};

@Injectable()
export class CoversService {
  private readonly log = new Logger(CoversService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openLibrary: OpenLibraryClient,
  ) {}

  /**
   * The stored image, if the book is this user's and has one.
   *
   * The ownership filter runs through the relation rather than as a second
   * query, so a cover belonging to someone else's book is a 404 for the same
   * reason their book is (S0.3) — and, as everywhere, a 404 rather than a 403,
   * which would confirm the id exists.
   */
  async find(userId: string, bookId: string): Promise<StoredCover> {
    const cover = ownedOrNotFound(
      await this.prisma.cover.findFirst({
        where: { bookId, book: { userId } },
        select: { data: true, mimeType: true, updatedAt: true },
      }),
    );

    return {
      data: Buffer.from(cover.data),
      mimeType: cover.mimeType,
      version: cover.updatedAt,
    };
  }

  /**
   * S4.3 — the manual upload.
   *
   * The format is decided by the first bytes of the file, never by the
   * `Content-Type` the request carried: the header is the client's claim, and
   * this image gets served back from our own origin under whatever label we
   * store. The size ceiling is enforced upstream, while the body is being
   * read, so that a huge upload is refused before it is entirely in memory.
   *
   * `upsert`, because a book has exactly one cover (§D18's 1:1) and a second
   * upload means "use this one instead". The row's `updatedAt` moves with it,
   * which is what changes the URL and gets past the year-long cache.
   */
  async upload(userId: string, bookId: string, data: Buffer): Promise<CoverRef> {
    // Ownership first: a stranger's book id must not be distinguishable from a
    // nonexistent one by how long the request takes to fail, or by whether the
    // complaint is about the image.
    await this.ownedBook(userId, bookId);

    const mimeType = sniffCoverMimeType(data);

    if (mimeType === null) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "COVER_FORMAT_UNSUPPORTED",
        "error.cover.formatUnsupported",
      );
    }

    const version = await this.store(bookId, data, mimeType, "UPLOAD");

    return { coverUrl: coverUrl(bookId, version) };
  }

  /**
   * S4.1 / §D8 — the cover that arrives with a book created from Open Library.
   *
   * **Best-effort, and deliberately silent.** It runs inside `POST /books`,
   * where the thing being asked for is a book; an external image service that
   * is slow, down, or has nothing for this edition must not turn that into a
   * failed save. The book is created either way and S4.3's upload is the way
   * to fix it afterwards — which is the degradation criterion applied to the
   * one place it is easiest to get wrong.
   *
   * Returns the stored image's version, or `null` if there is now no cover —
   * whether because the edition has none or because the attempt failed. The
   * caller needs it to put a `coverUrl` on the book it is about to return, and
   * cannot tell the two outcomes apart, which is correct: neither changes what
   * happens next.
   */
  async downloadFromOpenLibrary(
    bookId: string,
    editionKey: string,
  ): Promise<Date | null> {
    try {
      const image = await this.openLibrary.image(editionKey, "L");

      if (image === null) {
        // Not an error: plenty of editions simply have no large cover, which
        // is the case S4.3's placeholder exists for.
        return null;
      }

      return await this.store(bookId, image.data, image.mimeType, "OPEN_LIBRARY");
    } catch (cause) {
      this.log.warn(
        `Cover for edition ${editionKey} could not be stored on book ${bookId}: ${String(cause)}`,
      );

      return null;
    }
  }

  private async store(
    bookId: string,
    data: Buffer,
    mimeType: string,
    source: CoverSource,
  ): Promise<Date> {
    // Prisma's `Bytes` wants a `Uint8Array` backed by a plain `ArrayBuffer`,
    // while a `Buffer` may sit on a `SharedArrayBuffer` as far as the types
    // are concerned. Copying is the honest conversion, and a cover is a couple
    // of hundred kilobytes.
    const bytes = new Uint8Array(data);

    const cover = await this.prisma.cover.upsert({
      where: { bookId },
      create: { bookId, data: bytes, mimeType, source },
      update: { data: bytes, mimeType, source },
      select: { updatedAt: true },
    });

    return cover.updatedAt;
  }

  private async ownedBook(userId: string, bookId: string): Promise<void> {
    ownedOrNotFound(
      await this.prisma.book.findFirst({
        where: { id: bookId, userId },
        select: { id: true },
      }),
    );
  }
}
