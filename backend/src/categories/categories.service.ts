import { HttpStatus, Injectable } from "@nestjs/common";
import type { CategoryTree } from "@bookcsi/shared";
import { AppError } from "../common/app-error";
import { PrismaService } from "../prisma/prisma.service";

/**
 * §D45 — the taxonomy's read side, and the guard that keeps a book's category
 * codes honest.
 *
 * The tree is a controlled vocabulary that changes only by migration (there is
 * no admin story), so it is safe to read straight from the two tables on each
 * request — 26 groups and ~240 rows, one ordered query each. Both frontends
 * fetch it once and cache it hard; this service does not cache, so a taxonomy
 * migration takes effect on the next request without a restart dance.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The whole tree, groups and their shelves both in display order — the
   * payload of `GET /categories`. Both labels ride on every node so a client
   * can switch language without refetching (§D45).
   */
  async tree(): Promise<CategoryTree> {
    const groups = await this.prisma.categoryGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: { categories: { orderBy: { sortOrder: "asc" } } },
    });

    return groups.map((group) => ({
      code: group.code,
      labelRo: group.labelRo,
      labelEn: group.labelEn,
      categories: group.categories.map((category) => ({
        code: category.code,
        labelRo: category.labelRo,
        labelEn: category.labelEn,
      })),
    }));
  }

  /**
   * Reject a write that names a category that does not exist. The valid set is
   * data, not a compile-time enum, so this is the check the type system used to
   * do for `Genre` (§D45). Deduped before counting so a repeated code is not
   * mistaken for two.
   *
   * A group code slips through the `min(1)` schema but not this: only leaf
   * `Category` rows exist as rows, so a heading like `FICTION` is reported as
   * unknown here — which is exactly the "a group is not selectable" rule.
   */
  async assertExist(codes: readonly string[]): Promise<void> {
    const unique = [...new Set(codes)];

    if (unique.length === 0) {
      return;
    }

    const found = await this.prisma.category.findMany({
      where: { code: { in: unique } },
      select: { code: true },
    });

    if (found.length === unique.length) {
      return;
    }

    const known = new Set(found.map((row) => row.code));
    const unknown = unique.filter((code) => !known.has(code));

    // A 400 shaped like a field validation failure, so the client attaches it
    // to the category input the same way it does a schema error.
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "VALIDATION_FAILED",
      "error.category.unknown",
      { field: "categories", vars: { codes: unknown.join(", ") } },
    );
  }
}
