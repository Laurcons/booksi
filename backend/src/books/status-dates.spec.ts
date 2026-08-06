import type { Status } from "@bookcsi/shared";
import { autoDatedField, STATUS_DATE_FIELD } from "./status-dates";

const NO_DATES = { purchasedOn: null, startedOn: null, finishedOn: null };

const decide = (overrides: {
  status?: Status;
  previousStatus?: Status | null;
  provided?: string[];
  stored?: Partial<Record<keyof typeof NO_DATES, Date | null>>;
}) =>
  autoDatedField({
    status: overrides.status,
    previousStatus: overrides.previousStatus ?? null,
    provided: new Set(overrides.provided ?? []),
    stored: { ...NO_DATES, ...overrides.stored },
  });

describe("automatic status dates (S1.5)", () => {
  it("stamps the date that belongs to the new status", () => {
    expect(decide({ status: "PURCHASED" })).toBe("purchasedOn");
    expect(decide({ status: "READING" })).toBe("startedOn");
    expect(decide({ status: "FINISHED" })).toBe("finishedOn");
  });

  it("stamps nothing for wishlist — wanting a book is not an event", () => {
    expect(decide({ status: "WISHLIST" })).toBeNull();
  });

  it("stamps nothing for abandonment, keeping it off the finished-per-month chart", () => {
    // §D11: an abandoned book contributes pages but is never counted as read,
    // so it must not acquire a `finishedOn` that S7.2 would group by.
    expect(decide({ status: "ABANDONED", previousStatus: "READING" })).toBeNull();
  });

  it("leaves a date the request supplied itself alone", () => {
    expect(decide({ status: "FINISHED", provided: ["finishedOn"] })).toBeNull();
  });

  it("treats an explicit null as a deliberate clear, not as a gap to fill", () => {
    // The form sent `finishedOn: null` in the same request that set the
    // status. Overwriting it with today would make the field impossible to
    // empty.
    expect(
      decide({
        status: "FINISHED",
        previousStatus: "READING",
        provided: ["status", "finishedOn"],
      }),
    ).toBeNull();
  });

  it("never overwrites a date already recorded", () => {
    // Re-reading a book returns it to READING (§D12); the day it was first
    // started is history and stays put.
    expect(
      decide({
        status: "READING",
        previousStatus: "FINISHED",
        stored: { startedOn: new Date("2019-03-01T00:00:00Z") },
      }),
    ).toBe(null);
  });

  it("ignores a status that is being re-sent rather than changed", () => {
    expect(decide({ status: "READING", previousStatus: "READING" })).toBeNull();
  });

  it("ignores a request that does not touch the status at all", () => {
    expect(decide({ status: undefined, previousStatus: "WISHLIST" })).toBeNull();
  });

  it("stamps on creation, so an already-read book can be typed in", () => {
    // previousStatus is null: creating straight into FINISHED is a transition.
    expect(decide({ status: "FINISHED", previousStatus: null })).toBe("finishedOn");
  });

  it("covers every status, so a new one cannot be forgotten", () => {
    const statuses: Status[] = [
      "WISHLIST",
      "PURCHASED",
      "READING",
      "FINISHED",
      "ABANDONED",
    ];

    for (const status of statuses) {
      expect(STATUS_DATE_FIELD).toHaveProperty(status);
    }
  });
});
