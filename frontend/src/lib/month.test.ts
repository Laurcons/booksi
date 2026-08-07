import { describe, expect, it } from "vitest";
import { monthLabel, monthTick } from "./month";

describe("monthLabel", () => {
  it("writes the month out, in Romanian, with its year", () => {
    expect(monthLabel("2026-08")).toBe("august 2026");
  });

  it("handles the first and last month of the year", () => {
    expect(monthLabel("2026-01")).toBe("ianuarie 2026");
    expect(monthLabel("2026-12")).toBe("decembrie 2026");
  });
});

describe("monthTick", () => {
  it("abbreviates, because a tick has no room for a word", () => {
    expect(monthTick("2026-08")).toBe("aug.");
  });

  it("carries the year in January, where the year actually changes", () => {
    // A dense multi-year series is the normal case (§D31), and bare month
    // names would leave the reader guessing which year a bar belongs to.
    expect(monthTick("2027-01")).toBe("ian. 2027");
  });

  it("leaves the year off every other month, so the axis stays readable", () => {
    expect(monthTick("2027-02")).toBe("feb.");
    expect(monthTick("2027-12")).toBe("dec.");
  });

  it("keeps the one month that needs no abbreviating", () => {
    expect(monthTick("2026-05")).toBe("mai");
  });
});
