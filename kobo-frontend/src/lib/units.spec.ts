import { describe, expect, it } from "vitest";
import { mm, pt, webPx } from "./units";

// Pinned against the table in docs/kobo_design.md §Unități and §Scara: if
// these numbers ever change, that document is wrong until it is edited too.
describe("pt", () => {
  it.each([
    [28, 117],
    [20, 83],
    [14, 58],
    [12, 50],
    [10, 42],
    [9, 38],
  ])("resolves %dpt to %dpx", (points, px) => {
    expect(pt(points)).toBe(px);
  });
});

describe("mm", () => {
  it.each([
    [9, 106],
    [5, 59],
    [3, 35],
  ])("resolves %dmm to %dpx", (millimeters, px) => {
    expect(mm(millimeters)).toBe(px);
  });
});

describe("webPx", () => {
  it.each([
    [1, 3],
    [2, 6],
  ])("rescales a 96ppi %dpx to %dpx on this panel", (pixels, px) => {
    expect(webPx(pixels)).toBe(px);
  });
});
