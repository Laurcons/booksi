import { Module } from "@nestjs/common";
import { CoversModule } from "../covers/covers.module";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

@Module({
  // Sprint 4: creating a book with an `olEditionKey` downloads its cover (§D8),
  // which is the covers module's job. One direction only — covers checks
  // ownership itself rather than reaching back for `BooksService`.
  imports: [CoversModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
