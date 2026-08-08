import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const items = Array.from({ length: 45 }, (_, i) => i + 1);

describe("paginate", () => {
  it("slices at the given page size", () => {
    const page = paginate(items, 1, 20);

    expect(page.items).toEqual(items.slice(0, 20));
    expect(page.totalPages).toBe(3);
  });

  it("returns the last, partial page correctly", () => {
    const page = paginate(items, 3, 20);

    expect(page.items).toEqual(items.slice(40, 45));
  });

  it("clamps a page requested past the end to the last real one", () => {
    const page = paginate(items, 99, 20);

    expect(page.page).toBe(3);
    expect(page.items).toEqual(items.slice(40, 45));
  });

  it("clamps a page below 1 up to the first", () => {
    const page = paginate(items, 0, 20);

    expect(page.page).toBe(1);
  });

  it("treats a garbage page value the same as page 1", () => {
    const page = paginate(items, Number.NaN, 20);

    expect(page.page).toBe(1);
  });

  it("is one full page, never zero, for an empty library", () => {
    const page = paginate([], 1, 20);

    expect(page.totalPages).toBe(1);
    expect(page.items).toEqual([]);
  });
});
