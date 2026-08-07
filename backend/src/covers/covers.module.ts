import { Module } from "@nestjs/common";
import { OpenLibraryModule } from "../openlibrary/open-library.module";
import { CoversController } from "./covers.controller";
import { CoversService } from "./covers.service";

/**
 * Sprint 4. Exports the service because `BooksService` calls it on creation —
 * the download that §D8 asks for.
 *
 * The dependency runs one way only: books → covers → open library. Ownership
 * is re-checked here against Prisma rather than delegated to `BooksService`,
 * which is what keeps it that way; the alternative is a cycle between the two
 * modules for the sake of one `findFirst`.
 */
@Module({
  imports: [OpenLibraryModule],
  controllers: [CoversController],
  providers: [CoversService],
  exports: [CoversService],
})
export class CoversModule {}
