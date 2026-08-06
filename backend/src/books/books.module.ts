import { Module } from "@nestjs/common";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

@Module({
  controllers: [BooksController],
  providers: [BooksService],
  // Sprint 4 attaches covers to books through this service, so it leaves the
  // module rather than staying private to the controller.
  exports: [BooksService],
})
export class BooksModule {}
