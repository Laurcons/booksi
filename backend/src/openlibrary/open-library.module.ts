import { Module } from "@nestjs/common";
import { OpenLibraryClient } from "./open-library.client";
import { OpenLibraryController } from "./open-library.controller";
import { OpenLibraryService } from "./open-library.service";

/**
 * Sprint 4. The client is exported on its own because the covers module needs
 * it without needing the search: downloading a cover at creation time (§D8) is
 * a fetch, not a lookup.
 */
@Module({
  controllers: [OpenLibraryController],
  providers: [OpenLibraryClient, OpenLibraryService],
  exports: [OpenLibraryClient],
})
export class OpenLibraryModule {}
