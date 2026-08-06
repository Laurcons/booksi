import { Injectable } from "@nestjs/common";
import type { Book as BookRow, Prisma } from "@prisma/client";
import {
  normalizeIsbn,
  type Book,
  type CreateBookInput,
  type Genre,
  type IsbnDuplicate,
  type IsbnDuplicatesQuery,
  type ListBooksQuery,
  type Status,
  type UpdateBookInput,
} from "@bookcsi/shared";
import { ownedOrNotFound } from "../common/ownership";
import { PrismaService } from "../prisma/prisma.service";
import { fromCalendarDate, toCalendarDate, todayCalendarDate } from "./calendar-date";
import { autoDatedField } from "./status-dates";

/**
 * The write payload, narrowed to the fields Sprint 1 owns. An absent key means
 * "leave this column alone" — Prisma's own convention, which is why the
 * request's optional fields can be passed straight through.
 */
type BookWriteData = {
  title?: string;
  author?: string | null;
  isbn?: string | null;
  totalPages?: number | null;
  genre?: Genre | null;
  status?: Status;
  purchasedOn?: Date | null;
  startedOn?: Date | null;
  finishedOn?: Date | null;
};

const DEFAULT_STATUS: Status = "WISHLIST";

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  /** S1.1. */
  async create(userId: string, input: CreateBookInput): Promise<Book> {
    const status = input.status ?? DEFAULT_STATUS;

    const data: BookWriteData & { title: string } = {
      ...writeData(input),
      title: input.title,
    };

    // A book can be created straight into `FINISHED` while typing in a shelf
    // that already exists, and that still counts as a transition (§D12).
    const field = autoDatedField({
      status,
      previousStatus: null,
      provided: new Set(Object.keys(input)),
      stored: { purchasedOn: null, startedOn: null, finishedOn: null },
    });

    if (field !== null) {
      data[field] = fromCalendarDate(todayCalendarDate());
    }

    const row = await this.prisma.book.create({ data: { ...data, userId } });

    return toBook(row);
  }

  /** S1.2. */
  async findAll(userId: string, query: ListBooksQuery): Promise<Book[]> {
    const rows = await this.prisma.book.findMany({
      where: { userId },
      // `id` breaks ties so that two books sharing an author (or a status, or
      // a creation timestamp) keep a stable order between requests instead of
      // swapping places on every reload.
      orderBy: [{ [query.sort]: query.order }, { id: "asc" }],
    });

    return rows.map(toBook);
  }

  async findOne(userId: string, id: string): Promise<Book> {
    return toBook(await this.load(userId, id));
  }

  /** S1.3 and S1.4 — one route: a status change is an edit like any other. */
  async update(userId: string, id: string, input: UpdateBookInput): Promise<Book> {
    const existing = await this.load(userId, id);

    const data = writeData(input);

    const field = autoDatedField({
      status: input.status,
      previousStatus: existing.status,
      provided: new Set(Object.keys(input)),
      stored: {
        purchasedOn: existing.purchasedOn,
        startedOn: existing.startedOn,
        finishedOn: existing.finishedOn,
      },
    });

    if (field !== null) {
      data[field] = fromCalendarDate(todayCalendarDate());
    }

    // Ownership was settled by `load`; the id alone is enough to address the row.
    const row = await this.prisma.book.update({ where: { id }, data });

    return toBook(row);
  }

  /** S1.3. The confirmation prompt is the client's job; this is unconditional. */
  async remove(userId: string, id: string): Promise<void> {
    // Scoped by `userId`, so somebody else's id deletes nothing — and a count
    // of zero is indistinguishable from a book that never existed, which is
    // the 404 S0.3 asks for.
    const { count } = await this.prisma.book.deleteMany({ where: { id, userId } });

    ownedOrNotFound(count === 0 ? null : count);
  }

  /**
   * S1.1 / §D13. Comparison happens here rather than in SQL because the stored
   * value keeps the user's punctuation, and MariaDB has no way to strip it in
   * a `WHERE` clause without a generated column. A personal library is a few
   * hundred rows with an ISBN at most — the scan costs less than the schema
   * change would.
   */
  async isbnDuplicates(
    userId: string,
    query: IsbnDuplicatesQuery,
  ): Promise<IsbnDuplicate[]> {
    const wanted = normalizeIsbn(query.isbn);

    if (wanted === "") {
      return [];
    }

    const candidates = await this.prisma.book.findMany({
      where: {
        userId,
        isbn: { not: null },
        ...(query.excludeId === undefined ? {} : { id: { not: query.excludeId } }),
      },
      select: { id: true, title: true, author: true, isbn: true },
      orderBy: { createdAt: "asc" },
    });

    return candidates
      .filter((candidate) => normalizeIsbn(candidate.isbn ?? "") === wanted)
      .map(({ id, title, author }) => ({ id, title, author }));
  }

  private async load(userId: string, id: string): Promise<BookRow> {
    return ownedOrNotFound(
      await this.prisma.book.findFirst({ where: { id, userId } }),
    );
  }
}

function writeData(input: UpdateBookInput): BookWriteData {
  return {
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    totalPages: input.totalPages,
    genre: input.genre,
    status: input.status,
    // A date only moves when the request says so — `"key" in input` separates
    // "cleared it" (null) from "did not mention it" (absent), which
    // `?? undefined` would flatten into the same thing.
    purchasedOn: providedDate(input, "purchasedOn"),
    startedOn: providedDate(input, "startedOn"),
    finishedOn: providedDate(input, "finishedOn"),
  };
}

function providedDate(
  input: UpdateBookInput,
  key: "purchasedOn" | "startedOn" | "finishedOn",
): Date | null | undefined {
  return key in input ? fromCalendarDate(input[key] ?? null) : undefined;
}

/**
 * The row as the API exposes it. Written out field by field on purpose: the
 * mapping is also the boundary that keeps `manuallyEditedFields` — internal
 * bookkeeping for S4.4 — from leaking into every response.
 *
 * `Decimal` becomes a number here. The exact arithmetic that §D18 asks for
 * happens in SQL; what crosses the wire is only ever displayed.
 */
function toBook(row: BookRow): Book {
  return {
    id: row.id,

    title: row.title,
    author: row.author,
    isbn: row.isbn,
    totalPages: row.totalPages,
    genre: row.genre,

    status: row.status,
    favorite: row.favorite,
    pagesRead: row.pagesRead,
    rating: row.rating,

    estimatedPrice: toNumber(row.estimatedPrice),
    paidPrice: toNumber(row.paidPrice),

    purchasedOn: toCalendarDate(row.purchasedOn),
    startedOn: toCalendarDate(row.startedOn),
    finishedOn: toCalendarDate(row.finishedOn),

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
