import { BadRequestException, Injectable } from "@nestjs/common";
// `Prisma` is a value here, not just a namespace: `Prisma.Decimal` constructs
// the money columns on the way in.
import { Prisma, type Book as BookRow } from "@prisma/client";
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
  type WishlistSummary,
} from "@bookcsi/shared";
import { ownedOrNotFound } from "../common/ownership";
import { PrismaService } from "../prisma/prisma.service";
import { fromCalendarDate, toCalendarDate, todayCalendarDate } from "./calendar-date";
import { RATING_STATUS_MESSAGE, ratingAccepted } from "./rating";
import { autoDatedField } from "./status-dates";

/**
 * The write payload, narrowed to the fields the API currently lets a request
 * set. An absent key means "leave this column alone" — Prisma's own
 * convention, which is why the request's optional fields can be passed
 * straight through.
 */
type BookWriteData = {
  title?: string;
  author?: string | null;
  isbn?: string | null;
  totalPages?: number | null;
  genre?: Genre | null;
  status?: Status;
  pagesRead?: number;
  rating?: number | null;
  paidPrice?: Prisma.Decimal | null;
  estimatedPrice?: Prisma.Decimal | null;
  purchasedOn?: Date | null;
  startedOn?: Date | null;
  finishedOn?: Date | null;
};

/**
 * Either kind of write. `CreateBookInput` is assignable to `UpdateBookInput`
 * — the second is the first, partialised — so the helpers below type-checked
 * while claiming to take only updates. Naming the union says what is true, and
 * stops a reader concluding that `create` was passing the wrong thing.
 */
type BookWriteInput = CreateBookInput | UpdateBookInput;

const DEFAULT_STATUS: Status = "WISHLIST";

/** The status S3.1's view and S3.3's total are both defined by. */
const WISHLIST: Status = "WISHLIST";

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  /** S1.1. */
  async create(userId: string, input: CreateBookInput): Promise<Book> {
    const status = input.status ?? DEFAULT_STATUS;

    this.checkRating(input.rating, status);

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

  /** S1.2, and with the filter applied, the wishlist view of S3.1. */
  async findAll(userId: string, query: ListBooksQuery): Promise<Book[]> {
    const rows = await this.prisma.book.findMany({
      where: { userId, ...(query.status === undefined ? {} : { status: query.status }) },
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

  /**
   * S3.3. Summed in SQL over `DECIMAL(10,2)`, so the total is exact and stays
   * exact however long the wishlist grows — the same reason §D6's two prices
   * are decimal columns rather than floats.
   *
   * One aggregate, not two queries: `_count.estimatedPrice` counts the non-null
   * values while `_count._all` counts the rows, which is precisely the "7 din
   * 11" the story asks to print under the total.
   */
  async wishlistSummary(userId: string): Promise<WishlistSummary> {
    const summary = await this.prisma.book.aggregate({
      where: { userId, status: WISHLIST },
      _sum: { estimatedPrice: true },
      _count: { _all: true, estimatedPrice: true },
    });

    return {
      // `SUM` over no rows is NULL; an empty wishlist costs 0, not "unknown".
      total: toNumber(summary._sum.estimatedPrice) ?? 0,
      priced: summary._count.estimatedPrice,
      count: summary._count._all,
    };
  }

  /** S1.3 and S1.4 — one route: a status change is an edit like any other. */
  async update(userId: string, id: string, input: UpdateBookInput): Promise<Book> {
    const existing = await this.load(userId, id);

    // The status the book ends up in, which is what S2.3 constrains — a
    // request may set the rating and the status that permits it at once.
    this.checkRating(input.rating, input.status ?? existing.status);

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

  /**
   * S3.4 — "am cumpărat-o", in one click and without a modal: the status, the
   * date and the price move together, and all three stay editable afterwards
   * through the ordinary `PATCH`.
   *
   * A route of its own rather than a `PATCH` the client assembles, because the
   * rule being applied is `paidPrice → estimatedPrice` (§D6), and a client that
   * has to know that rule is a second place it can be got wrong.
   *
   * **`purchasedOn` is overwritten, unlike everywhere else.** S1.5's rule that
   * a recorded date is never overwritten protects history that the user did not
   * ask to change; here they did — this is an explicit "I bought it", and the
   * day it names is today. The two rules only ever meet on a book that was
   * bought, sent back to the wishlist and bought again, and for that book the
   * new purchase is the true one.
   *
   * The price is copied only when there is one. Without an estimate `paidPrice`
   * is left exactly as it was — the action does not block (the story is
   * explicit) and neither does it erase a figure it was never given.
   */
  async purchase(userId: string, id: string): Promise<Book> {
    const existing = await this.load(userId, id);

    const data: BookWriteData = {
      status: "PURCHASED",
      purchasedOn: fromCalendarDate(todayCalendarDate()),
    };

    if (existing.estimatedPrice !== null) {
      data.paidPrice = existing.estimatedPrice;
    }

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

  /**
   * S2.3. A 400 shaped like anything `ZodValidationPipe` produces, because to
   * the client it is the same kind of error — this rule just needs the stored
   * row to decide, so it cannot live in the schema.
   */
  private checkRating(rating: number | null | undefined, status: Status): void {
    if (!ratingAccepted(rating, status)) {
      throw new BadRequestException([`rating: ${RATING_STATUS_MESSAGE}`]);
    }
  }

  private async load(userId: string, id: string): Promise<BookRow> {
    return ownedOrNotFound(
      await this.prisma.book.findFirst({ where: { id, userId } }),
    );
  }
}

function writeData(input: BookWriteInput): BookWriteData {
  return {
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    totalPages: input.totalPages,
    genre: input.genre,
    status: input.status,
    pagesRead: input.pagesRead,
    rating: input.rating,
    paidPrice: toDecimal(input.paidPrice),
    estimatedPrice: toDecimal(input.estimatedPrice),
    // A date only moves when the request says so — `"key" in input` separates
    // "cleared it" (null) from "did not mention it" (absent), which
    // `?? undefined` would flatten into the same thing.
    purchasedOn: providedDate(input, "purchasedOn"),
    startedOn: providedDate(input, "startedOn"),
    finishedOn: providedDate(input, "finishedOn"),
  };
}

/**
 * S2.4. `undefined` and `null` pass through unchanged — Prisma reads them as
 * "leave it" and "clear it", the same two meanings the request carries.
 *
 * A number becomes a `Decimal` through its two-decimal string rather than
 * directly: `new Prisma.Decimal(59.9)` starts from the double, and the column
 * is `DECIMAL(10,2)`. Going via `toFixed(2)` puts the rounding here, where the
 * value has already been validated to have no third decimal, instead of
 * leaving it to the driver.
 */
function toDecimal(
  value: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return new Prisma.Decimal(value.toFixed(2));
}

function providedDate(
  input: BookWriteInput,
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
