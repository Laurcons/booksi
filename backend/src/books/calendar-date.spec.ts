import {
  fromCalendarDate,
  toCalendarDate,
  todayCalendarDate,
} from "./calendar-date";

describe("calendar dates", () => {
  it("round-trips a day without drifting", () => {
    expect(toCalendarDate(fromCalendarDate("2026-08-05"))).toBe("2026-08-05");
  });

  it("anchors a stored day at midnight UTC, where Prisma expects it", () => {
    expect(fromCalendarDate("2026-08-05")?.toISOString()).toBe(
      "2026-08-05T00:00:00.000Z",
    );
  });

  it("passes null through in both directions", () => {
    expect(fromCalendarDate(null)).toBeNull();
    expect(toCalendarDate(null)).toBeNull();
  });

  it("stamps the local day, not the UTC one", () => {
    // 01:30 in the morning of 5 August, local time. East of UTC that same
    // instant is still 4 August in UTC — the day the reader did not mean. A
    // `toISOString()`-based implementation would record yesterday.
    expect(todayCalendarDate(new Date(2026, 7, 5, 1, 30))).toBe("2026-08-05");
  });

  it("pads single-digit months and days", () => {
    expect(todayCalendarDate(new Date(2026, 0, 9, 12, 0))).toBe("2026-01-09");
  });
});
