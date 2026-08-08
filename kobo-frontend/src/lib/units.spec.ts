import { describe, expect, it } from "vitest";
import { mm, pt, webPx } from "./units";

// Pinned against the table in docs/kobo_design.md §Unități and §Scara: if
// these numbers ever change, that document is wrong until it is edited too.
// Halved from the first calibration (§Unități's own comment on `PX_PER_INCH`
// explains why) — the ratios between sizes are unchanged, only the constant
// they are struck from moved.
describe("pt", () => {
  it.each([
    [28, 58],
    [20, 42],
    [14, 29],
    [12, 25],
    [10, 21],
    [9, 19],
  ])("resolves %dpt to %dpx", (points, px) => {
    expect(pt(points)).toBe(px);
  });
});

describe("mm", () => {
  it.each([
    [9, 53],
    [5, 30],
    [3, 18],
  ])("resolves %dmm to %dpx", (millimeters, px) => {
    expect(mm(millimeters)).toBe(px);
  });
});

describe("webPx", () => {
  it.each([
    [1, 2],
    [2, 3],
  ])("rescales a 96ppi %dpx to %dpx on this panel", (pixels, px) => {
    expect(webPx(pixels)).toBe(px);
  });
});
