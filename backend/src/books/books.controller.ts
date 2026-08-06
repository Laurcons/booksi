import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createBookSchema,
  isbnDuplicatesQuerySchema,
  listBooksQuerySchema,
  updateBookSchema,
  type AuthUser,
  type Book,
  type CreateBookInput,
  type IsbnDuplicate,
  type IsbnDuplicatesQuery,
  type ListBooksQuery,
  type UpdateBookInput,
} from "@bookcsi/shared";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BooksService } from "./books.service";

/**
 * The whole controller sits behind the global `JwtAuthGuard` — no `@Public()`
 * anywhere — and every handler passes `user.id` down to the service, which is
 * the only place a `userId` may come from (S0.3).
 */
@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  /** S1.2. */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBooksQuerySchema)) query: ListBooksQuery,
  ): Promise<Book[]> {
    return this.books.findAll(user.id, query);
  }

  /**
   * S1.1 / §D13 — answers "do you already own this?" while the ISBN is being
   * typed. Declared above `:id` because Nest matches routes in declaration
   * order, and `:id` would otherwise swallow this path.
   */
  @Get("isbn-duplicates")
  isbnDuplicates(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(isbnDuplicatesQuerySchema))
    query: IsbnDuplicatesQuery,
  ): Promise<IsbnDuplicate[]> {
    return this.books.isbnDuplicates(user.id, query);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Book> {
    return this.books.findOne(user.id, id);
  }

  /** S1.1. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBookSchema)) input: CreateBookInput,
  ): Promise<Book> {
    return this.books.create(user.id, input);
  }

  /** S1.3, S1.4 and S1.5 — every edit, including a status change. */
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBookSchema)) input: UpdateBookInput,
  ): Promise<Book> {
    return this.books.update(user.id, id, input);
  }

  /** S1.3. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<void> {
    return this.books.remove(user.id, id);
  }
}
