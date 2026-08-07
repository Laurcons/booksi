import { describe, expect, it } from "vitest";
import { coverTargetSize, COVER_MAX_EDGE } from "./resize-cover";

/**
 * The decision inside the resize, tested apart from the drawing.
 *
 * jsdom has no canvas and no `createImageBitmap`, so `resizeCover` itself takes
 * its fallback path in this environment and would assert nothing about the
 * arithmetic. Splitting the sizing out is what makes the part with the rules in
 * it testable at all — and the rules are where the mistakes live.
 */
describe("coverTargetSize (S4.3)", () => {
  it("scales a tall cover down by its long edge", () => {
    // 1600×2400 is a plausible phone photograph of a book jacket.
    expect(coverTargetSize(1600, 2400)).toEqual({ width: 667, height: 1000 });
  });

  it("scales a wide image by its long edge too", () => {
    expect(coverTargetSize(2400, 1600)).toEqual({ width: 1000, height: 667 });
  });

  it("keeps the aspect ratio", () => {
    const { width, height } = coverTargetSize(1000, 1500);

    expect(width / height).toBeCloseTo(1000 / 1500, 2);
  });

  it("leaves an image that already fits alone", () => {
    // Scaling up would add bytes and no detail.
    expect(coverTargetSize(400, 600)).toEqual({ width: 400, height: 600 });
  });

  it("leaves an image exactly at the limit alone", () => {
    expect(coverTargetSize(COVER_MAX_EDGE, 500)).toEqual({
      width: COVER_MAX_EDGE,
      height: 500,
    });
  });

  it("never produces a zero-width canvas", () => {
    // `canvas.width = 0` throws, and a 20000×3 image is degenerate rather than
    // small — it should still come out drawable.
    const { width, height } = coverTargetSize(20_000, 3);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("survives a zero-sized image without dividing by it", () => {
    expect(coverTargetSize(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it("respects a smaller ceiling when told to use one", () => {
    expect(coverTargetSize(800, 400, 200)).toEqual({ width: 200, height: 100 });
  });
});
