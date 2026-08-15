import { describe, expect, it } from "vitest";
import {
  ROW_WIDTH,
  shelfRows,
  spineColor,
  spineWidth,
  SPINE_TITLE_WIDTH,
} from "./shelf";

describe("spineWidth (S8.2, §D33)", () => {
  it("gives a book with no page count the default thickness", () => {
    // §D4 — a missing page count is the ordinary case, not an error.
    expect(spineWidth(null)).toBe(24);
  });

  it("reaches both ends of the range, with books that exist", () => {
    // The whole of §D33: scaled from zero pages, neither end was reachable —
    // the floor because a book with no pages takes the default instead, the
    // ceiling because nothing is 750 pages of the way to 750 pages.
    expect(spineWidth(60)).toBe(14);
    expect(spineWidth(1200)).toBe(44);
  });

  it("stays inside the range docs/DESIGN.md declares", () => {
    for (const pages of [1, 80, 150, 320, 500, 900, 5000]) {
      expect(spineWidth(pages)).toBeGreaterThanOrEqual(14);
      expect(spineWidth(pages)).toBeLessThanOrEqual(44);
    }
  });

  it("gets thicker as the book gets longer", () => {
    expect(spineWidth(200)).toBeLessThan(spineWidth(400));
    expect(spineWidth(400)).toBeLessThan(spineWidth(800));
  });

  it("puts the title threshold inside the range, so the rule can apply", () => {
    // The prototype's minimum *was* the threshold, which made "show the title
    // only above 20px" a condition that could never be false.
    expect(spineWidth(100)).toBeLessThanOrEqual(SPINE_TITLE_WIDTH);
    expect(spineWidth(700)).toBeGreaterThan(SPINE_TITLE_WIDTH);
  });
});

describe("spineColor (§D17, §D19, §D39)", () => {
  it("has a colour for a book filed under nothing", () => {
    expect(spineColor(null)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("covers every category in the enum, not the eight the mock had", () => {
    expect(spineColor("POETRY_THEATRE")).toMatch(/^#[0-9a-f]{6}$/);
    expect(spineColor("EDUCATIONAL_SOFTWARE")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("shelfRows (S8.2)", () => {
  const widths = (row: number[]) => row;

  it("fills a row up to the plank's width and no further", () => {
    const books = Array.from({ length: 200 }, () => 44);

    for (const row of shelfRows(books, (width) => width)) {
      const used = row.reduce((sum, width) => sum + width + 3, 0);
      expect(used).toBeLessThanOrEqual(ROW_WIDTH);
    }
  });

  it("packs more thin books into a row than thick ones", () => {
    // The reason the count is not fixed: twenty-one paperbacks left a third of
    // the plank bare, and twenty-one doorstops ran off the end of it.
    const thin = shelfRows(Array.from({ length: 100 }, () => 14), (w) => w);
    const thick = shelfRows(Array.from({ length: 100 }, () => 44), (w) => w);

    expect(thin[0].length).toBeGreaterThan(thick[0].length);
  });

  it("keeps every book, in order", () => {
    const books = [14, 44, 20, 32, 24];

    expect(shelfRows(books, (width) => width, 60).flat()).toEqual(widths(books));
  });

  it("gives a book wider than an empty row its own row rather than dropping it", () => {
    expect(shelfRows([100, 10], (width) => width, 50)).toEqual([[100], [10]]);
  });

  it("draws no planks for an empty shelf", () => {
    expect(shelfRows([], (width: number) => width)).toEqual([]);
  });
});
