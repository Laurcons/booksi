import { bookOrderBy } from "./sort";

/**
 * §D51 — the sort mapping, which exists because one of the five sortable
 * columns stopped being a column.
 *
 * Its own spec rather than only the route's, for the reason `search.spec.ts`
 * gives about itself: the rule is worth checking without booting a controller,
 * and this is the file somebody will edit when a sixth sort value is added.
 */
describe("bookOrderBy (§D51)", () => {
  it.each(["title", "status", "createdAt", "purchasedOn"] as const)(
    "orders by %s as a plain column",
    (sort) => {
      expect(bookOrderBy(sort, "asc")).toEqual([{ [sort]: "asc" }, { id: "asc" }]);
    },
  );

  /**
   * The whole reason the file exists. `{ author: "asc" }` is not a shape Prisma
   * accepts for a relation field — it is a type error, and the runtime would
   * order by nothing — so the author needs the nested form.
   */
  it("orders by the author through the relation", () => {
    expect(bookOrderBy("author", "asc")).toEqual([
      { author: { name: "asc" } },
      { id: "asc" },
    ]);
  });

  it.each(["asc", "desc"] as const)("carries the direction through, %s", (order) => {
    expect(bookOrderBy("author", order)[0]).toEqual({ author: { name: order } });
    expect(bookOrderBy("title", order)[0]).toEqual({ title: order });
  });

  /**
   * The tie-break is not decoration, and it matters more since §D51: ordering
   * by a joined name puts every book by the same author on an equal footing, so
   * without `id` they would swap places between requests.
   */
  it("always breaks ties by id, so a reload does not reshuffle", () => {
    for (const sort of ["title", "author", "status", "createdAt", "purchasedOn"] as const) {
      expect(bookOrderBy(sort, "desc").at(-1)).toEqual({ id: "asc" });
    }
  });
});
