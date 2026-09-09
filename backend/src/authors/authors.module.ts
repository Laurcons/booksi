import { Module } from "@nestjs/common";
import { AuthorsController } from "./authors.controller";
import { AuthorsService } from "./authors.service";

/**
 * §D51 — the author entity. Exports `AuthorsService` so `BooksModule` can check
 * that an `authorId` on a book write belongs to the person making it, which is
 * the one thing a foreign key cannot do on its own.
 */
@Module({
  controllers: [AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}
