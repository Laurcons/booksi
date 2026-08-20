import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

/**
 * §D45 — the category taxonomy. Exports `CategoriesService` so `BooksModule`
 * can validate a write's category codes against it.
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
