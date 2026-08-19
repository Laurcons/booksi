import { searchTerms, searchWhere } from "./search";

describe("search (§D42)", () => {
  describe("searchTerms", () => {
    it("keeps a single word as one term", () => {
      expect(searchTerms("dune")).toEqual(["dune"]);
    });

    it("splits on whitespace", () => {
      expect(searchTerms("tolkien inel")).toEqual(["tolkien", "inel"]);
    });

    it("collapses runs of whitespace instead of producing empty terms", () => {
      // An empty term would become `contains: ""`, which every row satisfies —
      // the query would silently stop narrowing.
      expect(searchTerms("  tolkien   inel  ")).toEqual(["tolkien", "inel"]);
    });

    it("splits on tabs and newlines too, not just spaces", () => {
      // Pasted text arrives with both.
      expect(searchTerms("mircea\tcartarescu\norbitor")).toEqual([
        "mircea",
        "cartarescu",
        "orbitor",
      ]);
    });

    it("has no terms for a blank query", () => {
      // The schema turns "" into `undefined` before this is reached, so this is
      // the belt to that braces: no terms means no clause, never a clause that
      // matches everything.
      expect(searchTerms("")).toEqual([]);
      expect(searchTerms("   ")).toEqual([]);
    });
  });

  describe("searchWhere", () => {
    it("looks in all five fields for one word", () => {
      expect(searchWhere("dune")).toEqual([
        {
          OR: [
            { title: { contains: "dune" } },
            { author: { contains: "dune" } },
            { publisher: { contains: "dune" } },
            { isbn: { contains: "dune" } },
            { description: { contains: "dune" } },
          ],
        },
      ]);
    });

    it("gives every word its own clause, so all of them must match", () => {
      // AND of ORs, not OR of ANDs: adding a word narrows the result. The
      // opposite nesting would widen it, and the list would grow as the user
      // typed more of what they were after.
      const clauses = searchWhere("tolkien inel");

      expect(clauses).toHaveLength(2);
      expect(clauses[0].OR).toContainEqual({ title: { contains: "tolkien" } });
      expect(clauses[1].OR).toContainEqual({ title: { contains: "inel" } });
    });

    it("lets two words match two different fields", () => {
      // The point of splitting at all: neither field holds both words, so a
      // single `contains` over the whole string would find nothing.
      const [first, second] = searchWhere("herbert dune");

      expect(first.OR).toContainEqual({ author: { contains: "herbert" } });
      expect(second.OR).toContainEqual({ title: { contains: "dune" } });
    });

    it("passes wildcards through unescaped, by decision", () => {
      // `%` and `_` are LIKE wildcards and stay that way. Prisma parameterises
      // the value, so this is a user typing a wildcard, not an injection.
      expect(searchWhere("50%")[0].OR).toContainEqual({
        title: { contains: "50%" },
      });
    });

    it("produces no clause at all for a blank query", () => {
      expect(searchWhere("   ")).toEqual([]);
    });

    it("never asks for case-insensitive mode", () => {
      // `mode: "insensitive"` is Postgres-only; on MySQL it is unsupported, and
      // `utf8mb4_unicode_ci` already folds case *and* diacritics.
      expect(JSON.stringify(searchWhere("dune"))).not.toContain("mode");
    });
  });
});
