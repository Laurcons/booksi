import { describe, expect, it } from "vitest";
import {
  progressLabel,
  progressPercent,
  progressRatio,
  progressShortLabel,
} from "./progress";

describe("derived progress (S2.2)", () => {
  describe("progressRatio", () => {
    it("divides pages read by the total", () => {
      expect(progressRatio({ totalPages: 620, pagesRead: 155 })).toBeCloseTo(0.25);
    });

    it("is null when there is no page count (§D4)", () => {
      // The frequent case, not the exceptional one — hence a distinct value
      // rather than a zero that would draw an empty bar.
      expect(progressRatio({ totalPages: null, pagesRead: 143 })).toBeNull();
    });

    it("is null for a zero page count, not Infinity", () => {
      expect(progressRatio({ totalPages: 0, pagesRead: 143 })).toBeNull();
    });

    it("clamps past the end of the book", () => {
      // The API accepts a page beyond `totalPages` on purpose (§D7): the count
      // often belongs to another edition. The bar must not overflow for it.
      expect(progressRatio({ totalPages: 300, pagesRead: 700 })).toBe(1);
    });

    it("clamps a negative page count to zero", () => {
      expect(progressRatio({ totalPages: 300, pagesRead: -5 })).toBe(0);
    });
  });

  describe("progressPercent", () => {
    it("rounds to whole percents", () => {
      expect(progressPercent({ totalPages: 620, pagesRead: 143 })).toBe(23);
    });

    it("stays null without a page count", () => {
      expect(progressPercent({ totalPages: null, pagesRead: 143 })).toBeNull();
    });
  });

  describe("labels", () => {
    it("reads as a percentage when there is one", () => {
      expect(progressLabel({ totalPages: 620, pagesRead: 143 })).toBe(
        "23% — pag. 143 din 620",
      );
    });

    it("falls back to the page alone, exactly as S2.2 words it", () => {
      expect(progressLabel({ totalPages: null, pagesRead: 143 })).toBe("pag. 143");
      expect(progressShortLabel({ totalPages: null, pagesRead: 143 })).toBe(
        "pag. 143",
      );
    });

    it("never invents a percent sign for an unknown total", () => {
      expect(progressLabel({ totalPages: null, pagesRead: 143 })).not.toContain("%");
    });

    it("shortens to a fraction for the table cell", () => {
      expect(progressShortLabel({ totalPages: 620, pagesRead: 143 })).toBe("143/620");
    });
  });
});
