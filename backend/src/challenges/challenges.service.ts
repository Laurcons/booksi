import { Injectable } from "@nestjs/common";
import type { Challenge as ChallengeRow } from "@prisma/client";
import type {
  Book,
  Challenge,
  ChallengeSummary,
  CreateChallengeInput,
  Status,
  UpdateChallengeInput,
} from "@bookcsi/shared";
import { BooksService } from "../books/books.service";
import { fromCalendarDate, toCalendarDate } from "../books/calendar-date";
import { AppError } from "../common/app-error";
import { ownedOrNotFound } from "../common/ownership";
import { PrismaService } from "../prisma/prisma.service";

/** A challenge row together with its join rows, ordered the way they were
 * attached — the order `findOne` hands books back in. */
type ChallengeWithBooks = ChallengeRow & { books: { bookId: string }[] };

/** `ownedOrNotFound`'s default message is book-flavoured (every caller before
 * this one was about a book) — this is the challenge equivalent. */
const NOT_FOUND = "Provocarea asta nu există sau nu e a ta.";

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly books: BooksService,
  ) {}

  async list(userId: string): Promise<ChallengeSummary[]> {
    const rows = await this.prisma.challenge.findMany({
      where: { userId },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
      include: { books: { include: { book: { select: { status: true } } } } },
    });

    return rows.map(toSummary);
  }

  async findOne(userId: string, id: string): Promise<Challenge> {
    const row = await this.load(userId, id);
    return toChallenge(row, await this.orderedBooks(userId, row));
  }

  /**
   * `bookIds` is optional (a challenge can start empty, books attached
   * afterwards through `addBook`), but any id that *is* given must resolve to
   * a book this same user owns — checked once, up front, so the create either
   * fully succeeds or writes nothing.
   */
  async create(userId: string, input: CreateChallengeInput): Promise<Challenge> {
    const bookIds = input.bookIds ?? [];
    await this.assertOwnedBooks(userId, bookIds);

    const row = await this.prisma.challenge.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        deadline: fromCalendarDate(input.deadline)!,
        books:
          bookIds.length > 0 ? { create: bookIds.map((bookId) => ({ bookId })) } : undefined,
      },
    });

    return this.findOne(userId, row.id);
  }

  /** Every field editable at any time, same convention as `BooksService.update`
   * — book membership excluded, since that lives on `addBook`/`removeBook`. */
  async update(userId: string, id: string, input: UpdateChallengeInput): Promise<Challenge> {
    await this.load(userId, id);

    await this.prisma.challenge.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        deadline: input.deadline === undefined ? undefined : fromCalendarDate(input.deadline)!,
      },
    });

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    // Scoped by `userId`, so somebody else's id deletes nothing — a count of
    // zero is indistinguishable from a challenge that never existed, which is
    // the 404 S0.3's rule asks for everywhere else in this API.
    const { count } = await this.prisma.challenge.deleteMany({ where: { id, userId } });
    ownedOrNotFound(count === 0 ? null : count, NOT_FOUND);
  }

  /**
   * Idempotent by design: attaching a book already on the challenge is not an
   * error, it is the same state the caller asked for. `upsert` on the
   * composite key is what makes a second call a no-op instead of a unique
   * constraint violation.
   */
  async addBook(userId: string, challengeId: string, bookId: string): Promise<Challenge> {
    await this.load(userId, challengeId);
    await this.assertOwnedBooks(userId, [bookId]);

    await this.prisma.challengeBook.upsert({
      where: { challengeId_bookId: { challengeId, bookId } },
      create: { challengeId, bookId },
      update: {},
    });

    return this.findOne(userId, challengeId);
  }

  /** Also idempotent — detaching a book that is not on the challenge lands on
   * the same end state as one that was, so this does not 404 on a repeat call. */
  async removeBook(userId: string, challengeId: string, bookId: string): Promise<Challenge> {
    await this.load(userId, challengeId);
    await this.prisma.challengeBook.deleteMany({ where: { challengeId, bookId } });

    return this.findOne(userId, challengeId);
  }

  private async load(userId: string, id: string): Promise<ChallengeWithBooks> {
    return ownedOrNotFound(
      await this.prisma.challenge.findFirst({
        where: { id, userId },
        include: { books: { orderBy: { addedAt: "asc" }, select: { bookId: true } } },
      }),
      NOT_FOUND,
    );
  }

  /** `BooksService.findByIds` silently drops ids that are not this user's —
   * safe for reading, but here a dropped id would mean the challenge quietly
   * ends up with fewer books than the caller asked for, so membership is
   * counted explicitly first and rejected loudly if anything is missing. */
  private async assertOwnedBooks(userId: string, bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) {
      return;
    }

    const owned = await this.books.countOwned(userId, [...new Set(bookIds)]);

    if (owned !== new Set(bookIds).size) {
      throw AppError.notFound("Una sau mai multe cărți nu există sau nu sunt ale tale.");
    }
  }

  /** `findByIds` does not promise an order — reassert the attach order
   * (`row.books`, already `addedAt asc`) after the fetch. */
  private async orderedBooks(userId: string, row: ChallengeWithBooks): Promise<Book[]> {
    const ids = row.books.map((b) => b.bookId);
    const books = await this.books.findByIds(userId, ids);
    const byId = new Map(books.map((book) => [book.id, book]));

    return ids.map((id) => byId.get(id)).filter((book): book is Book => book !== undefined);
  }
}

function toChallenge(row: ChallengeRow, books: Book[]): Challenge {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: toCalendarDate(row.deadline)!,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    books,
  };
}

function toSummary(
  row: ChallengeRow & { books: { book: { status: Status } }[] },
): ChallengeSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: toCalendarDate(row.deadline)!,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    bookCount: row.books.length,
    finishedCount: row.books.filter((b) => b.book.status === "FINISHED").length,
  };
}
