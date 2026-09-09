import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  Author,
  AuthorDetail,
  AuthorSuggestion,
  CreateAuthorInput,
  DeleteAuthorResult,
  ListAuthorsQuery,
  UpdateAuthorInput,
} from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { ownedOrNotFound } from "../common/ownership";
import { PrismaService } from "../prisma/prisma.service";

/**
 * §D51 — the author entity's four operations, and no more than four.
 *
 * There is deliberately no rename and no merge. Both would be one `UPDATE` away
 * and both are refused for the same reason: on the wire, correcting a typo and
 * merging two people are the same request, and the second one silently rewrites
 * every book that pointed at the old name. `updateAuthorSchema` says the same
 * thing from the contract's side.
 *
 * Every method takes `userId` from the session and filters on it (S0.3). An
 * author id from another account answers 404 rather than 403 — the same rule
 * books follow, and here it matters twice over, because a 403 would confirm
 * that a stranger has an author by that id.
 */
@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `GET /authors?q=` — what the picker's dropdown is drawn from.
   *
   * `q` absent is the reader's whole list rather than an error or an empty
   * answer, which is what makes the dropdown usable for housekeeping: §D51
   * leaves no central author screen, so deleting an author no book points at
   * has to be possible from the picker without knowing its name first.
   *
   * `contains` is unindexable (`LIKE '%x%'`) and that is fine here for the same
   * reason it is fine on books (§D42): this is a personal library's author
   * list — hundreds of rows, not millions — and the collation does the case and
   * diacritic folding for free, so `sarpe` finds `Șarpe` with no normalised
   * column.
   *
   * `_count.books` rather than a stored counter. It is read on every keystroke
   * of a debounced query, which sounds like the case for denormalising until
   * you notice what a stored count would have to survive: a book created,
   * deleted, or edited to point elsewhere, an author deleted with `SetNull`
   * behind it, and the same three over MCP and from the Kobo. A `COUNT` over an
   * indexed foreign key cannot drift.
   */
  async findAll(userId: string, query: ListAuthorsQuery): Promise<AuthorSuggestion[]> {
    const rows = await this.prisma.author.findMany({
      where: {
        userId,
        // Absent, and the key is not present at all — the same absent-vs-empty
        // distinction the book filters make (§D29). An empty `contains` would
        // match every row, which is the same answer by accident rather than by
        // rule.
        ...(query.q === undefined ? {} : { name: { contains: query.q } }),
      },
      // Name order, not "most books first" and not recency. The dropdown is
      // read alphabetically when it is being browsed for housekeeping, and a
      // list that reorders itself as books are added is a list whose rows move
      // under the pointer.
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { books: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      bookCount: row._count.books,
    }));
  }

  /**
   * `GET /authors/:id` — the biography and the book count, for the form.
   *
   * The count is why this is not simply the embedded author off the book: the
   * form's one line of prose ("applies to all 4 books by …") needs it, and
   * putting it on `authorSchema` would mean a `COUNT` per row of every library
   * listing to render a number only this form shows.
   */
  async findOne(userId: string, id: string): Promise<AuthorDetail> {
    const row = ownedOrNotFound(
      await this.prisma.author.findFirst({
        where: { id, userId },
        include: { _count: { select: { books: true } } },
      }),
      "error.author.notFound",
    );

    return { ...toAuthor(row), bookCount: row._count.books };
  }

  /**
   * `POST /authors` — the deliberate creation, and **idempotent by name**.
   *
   * Idempotent rather than 409-on-collision, which is a decision worth the
   * paragraph. The client only offers to create when nothing matched, and its
   * "nothing matched" test folds names exactly as the unique index does
   * (`foldAuthorName`), so a collision here means one of three things: two tabs,
   * a dropdown the reader left open while the list moved underneath, or the
   * handful of equivalences the collation folds and the client's approximation
   * does not (`ß`/`ss` and relatives). All three want the same outcome — *give
   * me the author for this name* — and none of them wants an error the reader
   * has to read and act on.
   *
   * `P2002` rather than a check-then-insert, because check-then-insert is a
   * race with itself: two requests a millisecond apart both find nothing and
   * both insert, and the index rejects the second one anyway. Catching the
   * violation is the only version that is correct under concurrency, so it is
   * the only version worth writing.
   */
  async create(userId: string, input: CreateAuthorInput): Promise<Author> {
    try {
      return toAuthor(
        await this.prisma.author.create({
          data: { userId, name: input.name },
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return this.findByName(userId, input.name);
      }

      throw error;
    }
  }

  /**
   * `PATCH /authors/:id` — the biography, saved from whichever book's form the
   * reader happened to have open.
   *
   * `updateMany` scoped to `{ id, userId }` rather than `update` by id: an
   * `update` would need the row fetched first to check ownership, and the count
   * it returns answers the ownership question in the same statement. Zero rows
   * means absent or someone else's, which is the same 404 (S0.3).
   */
  async update(userId: string, id: string, input: UpdateAuthorInput): Promise<AuthorDetail> {
    const { count } = await this.prisma.author.updateMany({
      where: { id, userId },
      data: { biography: input.biography },
    });

    if (count === 0) {
      throw AppError.notFound("error.author.notFound");
    }

    return this.findOne(userId, id);
  }

  /**
   * `DELETE /authors/:id` — and the books that pointed at it keep standing.
   *
   * The `SetNull` is the database's, declared on the foreign key rather than
   * done here in two statements, so there is no window in which an author is
   * gone and a book still references it. What the caller is told is the number
   * of books that just lost their author: the client already knew it (it is
   * what the confirmation said), and returning it lets the form assert that
   * what it warned about is what happened.
   */
  async remove(userId: string, id: string): Promise<DeleteAuthorResult> {
    const author = ownedOrNotFound(
      await this.prisma.author.findFirst({
        where: { id, userId },
        select: { id: true, _count: { select: { books: true } } },
      }),
      "error.author.notFound",
    );

    await this.prisma.author.delete({ where: { id: author.id } });

    return { booksAffected: author._count.books };
  }

  /**
   * The ownership check every book write needs, as one query.
   *
   * `BooksService` calls this before writing an `authorId`, and the reason it
   * is here rather than inlined there is that "does this author exist" and
   * "does it belong to the person asking" must not come apart: a book pointing
   * at another account's author would put a stranger's name on the reader's
   * shelf, and the foreign key alone would happily allow it.
   */
  async assertOwned(userId: string, authorId: string): Promise<void> {
    ownedOrNotFound(
      await this.prisma.author.findFirst({
        where: { id: authorId, userId },
        select: { id: true },
      }),
      "error.author.notFound",
    );
  }

  /**
   * The collision path's other half. Looked up by name under the column's own
   * collation, so the row this finds is the row the index refused to duplicate.
   */
  private async findByName(userId: string, name: string): Promise<Author> {
    return toAuthor(
      ownedOrNotFound(
        await this.prisma.author.findFirst({ where: { userId, name } }),
        "error.author.notFound",
      ),
    );
  }
}

/**
 * The row as the API exposes it — written out field by field for the same
 * reason `toBook` is: the mapping is the boundary that keeps `userId` and the
 * timestamps from leaking into every response by default.
 */
function toAuthor(row: {
  id: string;
  name: string;
  biography: string | null;
}): Author {
  return { id: row.id, name: row.name, biography: row.biography };
}
