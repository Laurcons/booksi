import { Module } from "@nestjs/common";
import { BooksModule } from "../books/books.module";
import { ChallengesController } from "./challenges.controller";
import { ChallengesService } from "./challenges.service";

@Module({
  // `ChallengesService` never touches `prisma.book` directly — every read or
  // ownership check on a book goes through `BooksService`, so there is one
  // place that maps a book row to `Book` and one place that decides what
  // "owned" means.
  imports: [BooksModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
