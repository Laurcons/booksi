import { isRatable, type Status } from "@bookcsi/shared";
import { ratingAccepted } from "./rating";

const ALL_STATUSES: Status[] = [
  "WISHLIST",
  "PURCHASED",
  "READING",
  "FINISHED",
  "ABANDONED",
];

describe("rating rules (S2.3)", () => {
  describe("isRatable", () => {
    it("covers finished and abandoned, and nothing else", () => {
      expect(ALL_STATUSES.filter(isRatable)).toEqual(["FINISHED", "ABANDONED"]);
    });

    it("rates abandoned books, as §D11 requires", () => {
      // Giving up on a book is an opinion about it; the story lists ABANDONED
      // alongside FINISHED for exactly that reason.
      expect(isRatable("ABANDONED")).toBe(true);
    });
  });

  describe("ratingAccepted", () => {
    it("takes a rating on a book that has been put down", () => {
      expect(ratingAccepted(5, "FINISHED")).toBe(true);
      expect(ratingAccepted(1, "ABANDONED")).toBe(true);
    });

    it("refuses a rating on a book nobody has finished yet", () => {
      expect(ratingAccepted(4, "READING")).toBe(false);
      expect(ratingAccepted(4, "WISHLIST")).toBe(false);
      expect(ratingAccepted(4, "PURCHASED")).toBe(false);
    });

    it("ignores a request that does not mention the rating", () => {
      // Otherwise renaming a re-read book would fail over stars set months ago.
      for (const status of ALL_STATUSES) {
        expect(ratingAccepted(undefined, status)).toBe(true);
      }
    });

    it("always allows clearing", () => {
      // A rating stranded on a book that went back to READING has to have a
      // way out.
      for (const status of ALL_STATUSES) {
        expect(ratingAccepted(null, status)).toBe(true);
      }
    });
  });
});
