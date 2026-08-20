import { AppError } from "../common/app-error";
import { CategoriesService } from "./categories.service";

/** A minimal Prisma double — only the two models this service reads. */
function makeService(overrides: {
  groups?: unknown;
  categories?: { code: string }[];
}) {
  const prisma = {
    categoryGroup: {
      findMany: jest.fn().mockResolvedValue(overrides.groups ?? []),
    },
    category: {
      findMany: jest.fn().mockResolvedValue(overrides.categories ?? []),
    },
  };

  return {
    service: new CategoriesService(prisma as never),
    prisma,
  };
}

describe("CategoriesService (§D45)", () => {
  describe("tree()", () => {
    it("shapes groups and their shelves, both labels on every node", async () => {
      const { service, prisma } = makeService({
        groups: [
          {
            code: "FICTION",
            labelRo: "Ficțiune",
            labelEn: "Fiction",
            sortOrder: 0,
            categories: [
              { code: "FICTION__SF", labelRo: "SF", labelEn: "Science fiction", sortOrder: 1 },
            ],
          },
        ],
      });

      expect(await service.tree()).toEqual([
        {
          code: "FICTION",
          labelRo: "Ficțiune",
          labelEn: "Fiction",
          categories: [{ code: "FICTION__SF", labelRo: "SF", labelEn: "Science fiction" }],
        },
      ]);

      // Both levels asked for in display order — the picker relies on it.
      expect(prisma.categoryGroup.findMany.mock.calls[0][0]).toMatchObject({
        orderBy: { sortOrder: "asc" },
        include: { categories: { orderBy: { sortOrder: "asc" } } },
      });
    });
  });

  describe("assertExist()", () => {
    it("passes when every code is a real category", async () => {
      const { service, prisma } = makeService({
        categories: [{ code: "FICTION__SF" }, { code: "HISTORY__GENERAL" }],
      });

      await expect(
        service.assertExist(["FICTION__SF", "HISTORY__GENERAL"]),
      ).resolves.toBeUndefined();

      // Deduped before the query.
      expect([...prisma.category.findMany.mock.calls[0][0].where.code.in].sort()).toEqual([
        "FICTION__SF",
        "HISTORY__GENERAL",
      ]);
    });

    it("skips the query entirely for an empty set", async () => {
      const { service, prisma } = makeService({});

      await expect(service.assertExist([])).resolves.toBeUndefined();
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });

    it("throws a field-scoped 400 naming the unknown codes", async () => {
      const { service } = makeService({ categories: [{ code: "FICTION__SF" }] });

      const error = await service
        .assertExist(["FICTION__SF", "NOPE__NOPE"])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.field).toBe("categories");
      // The unknown one is named; the known one is not.
      expect(appError.messageFor("en")).toEqual([expect.stringContaining("NOPE__NOPE")]);
      expect(appError.messageFor("en")[0]).not.toContain("FICTION__SF");
    });

    it("rejects a group code, since only leaves exist as rows", async () => {
      // "a group is not selectable" falls out of this: a heading like FICTION
      // is not a Category row, so it reports as unknown.
      const { service } = makeService({ categories: [] });

      await expect(service.assertExist(["FICTION"])).rejects.toBeInstanceOf(AppError);
    });
  });
});
