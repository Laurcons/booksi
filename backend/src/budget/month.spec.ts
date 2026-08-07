import { currentMonth, denseMonths, monthOf, monthRange } from "./month";

describe("currentMonth", () => {
  it("reads the local month, not the UTC one", () => {
    // 01:00 on the 1st in a zone ahead of UTC is still the new month for the
    // person holding the book — the same call `todayCalendarDate` makes.
    const local = new Date(2026, 8, 1, 1, 0, 0);

    expect(currentMonth(local)).toBe("2026-09");
  });

  it("pads a single-digit month", () => {
    expect(currentMonth(new Date(2026, 0, 15))).toBe("2026-01");
  });
});

describe("monthOf", () => {
  it("reads the month off a @db.Date column, which is UTC midnight", () => {
    expect(monthOf(new Date("2026-07-01T00:00:00.000Z"))).toBe("2026-07");
  });
});

describe("monthRange", () => {
  it("is half-open: the first day of the month, and the first of the next", () => {
    expect(monthRange("2026-08")).toEqual({
      start: new Date("2026-08-01T00:00:00.000Z"),
      next: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("rolls over the year in December", () => {
    expect(monthRange("2026-12").next).toEqual(
      new Date("2027-01-01T00:00:00.000Z"),
    );
  });

  it("gets February right in a leap year, by not needing to know its length", () => {
    // The half-open range is why: `lte` the last day would have to decide
    // between the 28th and the 29th, and this never asks.
    expect(monthRange("2024-02").next).toEqual(
      new Date("2024-03-01T00:00:00.000Z"),
    );
  });
});

describe("denseMonths (S6.2)", () => {
  it("fills the months nobody bought anything in", () => {
    // Without the zeros, January would sit next to April at equal width and
    // the axis would stop being time.
    const months = denseMonths(
      [
        { month: "2026-01", spent: 120 },
        { month: "2026-04", spent: 60 },
      ],
      "2026-04",
    );

    expect(months).toEqual([
      { month: "2026-01", spent: 120 },
      { month: "2026-02", spent: 0 },
      { month: "2026-03", spent: 0 },
      { month: "2026-04", spent: 60 },
    ]);
  });

  it("runs to the current month even after a spending pause", () => {
    const months = denseMonths([{ month: "2026-06", spent: 40 }], "2026-08");

    expect(months.map((entry) => entry.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(months.at(-1)).toEqual({ month: "2026-08", spent: 0 });
  });

  it("crosses a year boundary", () => {
    const months = denseMonths([{ month: "2025-11", spent: 10 }], "2026-02");

    expect(months.map((entry) => entry.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns nothing at all for a library with no dated purchase", () => {
    // An empty chart, not one bar reading zero.
    expect(denseMonths([], "2026-08")).toEqual([]);
  });

  it("keeps a purchase dated past the current month rather than dropping it", () => {
    const months = denseMonths([{ month: "2026-10", spent: 25 }], "2026-08");

    expect(months).toEqual([{ month: "2026-10", spent: 25 }]);
  });

  it("starts at the first purchase, however old the library is", () => {
    const months = denseMonths(
      [
        { month: "2020-01", spent: 5 },
        { month: "2020-03", spent: 5 },
      ],
      "2020-03",
    );

    expect(months).toHaveLength(3);
    expect(months[0]).toEqual({ month: "2020-01", spent: 5 });
  });
});
