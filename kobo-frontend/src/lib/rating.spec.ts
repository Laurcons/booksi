import { describe, expect, it } from "vitest";
import { ratingLabel, STAR_GLYPHS_ENABLED } from "./rating";

describe("ratingLabel", () => {
  it("reads as an em dash, not zero stars, when there is no rating", () => {
    expect(ratingLabel(null)).toBe("—");
  });

  it.each([1, 2, 3, 4, 5])("renders %d as a mix of filled and empty glyphs", (rating) => {
    // Written against the current flag rather than a hardcoded glyph string,
    // so this test still passes the day §P8 gets answered and the flag flips.
    const label = ratingLabel(rating);

    if (STAR_GLYPHS_ENABLED) {
      expect(label).toBe("★".repeat(rating) + "☆".repeat(5 - rating));
    } else {
      expect(label).toBe(`${rating}/5`);
    }
  });
});
