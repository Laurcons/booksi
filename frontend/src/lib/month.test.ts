import { describe, expect, it } from "vitest";
import { translatorFor } from "../i18n/catalog";
import { monthLabel, monthTick } from "./month";

const ro = translatorFor("ro");
const en = translatorFor("en");

describe("monthLabel", () => {
  it("writes the month out with its year, in the reader's language", () => {
    expect(monthLabel("2026-08", ro)).toBe("august 2026");
    expect(monthLabel("2026-08", en)).toBe("August 2026");
  });

  it("handles the first and last month of the year", () => {
    expect(monthLabel("2026-01", ro)).toBe("ianuarie 2026");
    expect(monthLabel("2026-12", ro)).toBe("decembrie 2026");
    expect(monthLabel("2026-01", en)).toBe("January 2026");
    expect(monthLabel("2026-12", en)).toBe("December 2026");
  });
});

describe("monthTick", () => {
  it("abbreviates, because a tick has no room for a word", () => {
    expect(monthTick("2026-08", ro)).toBe("aug.");
    expect(monthTick("2026-08", en)).toBe("Aug");
  });

  it("carries the year in January, where the year actually changes", () => {
    // A dense multi-year series is the normal case (§D31), and bare month
    // names would leave the reader guessing which year a bar belongs to.
    expect(monthTick("2027-01", ro)).toBe("ian. 2027");
    expect(monthTick("2027-01", en)).toBe("Jan 2027");
  });

  it("leaves the year off every other month, so the axis stays readable", () => {
    expect(monthTick("2027-02", ro)).toBe("feb.");
    expect(monthTick("2027-12", ro)).toBe("dec.");
    expect(monthTick("2027-02", en)).toBe("Feb");
  });

  it("keeps the one month Romanian needs no abbreviation for", () => {
    // "mai" is already three letters, so it carries no trailing dot — the kind
    // of detail `Intl`'s own abbreviations would not have been stable about.
    expect(monthTick("2026-05", ro)).toBe("mai");
  });
});
