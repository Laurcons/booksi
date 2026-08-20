import { Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { CoversModule } from "../covers/covers.module";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

@Module({
  // Sprint 4: creating a book with an `olEditionKey` downloads its cover (§D8),
  // which is the covers module's job. One direction only — covers checks
  // ownership itself rather than reaching back for `BooksService`.
  //
  // §D45: `CategoriesService` validates a write's category codes before the
  // service attaches them.
  imports: [CoversModule, CategoriesModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
