import { describe, expect, it } from "vitest";
import { STATUS_VALUES, isRatable } from "@bookcsi/shared";
import { lockedReason } from "./locks";

/**
 * The five locks, as rules rather than as rendered pixels.
 *
 * Worth a test of their own for two reasons. They are the whole of the
 * "disabled, not hidden" design guideline — get one wrong and a field is either
 * dead when it should work or open when the API will refuse it — and the rating
 * lock has to keep agreeing with `isRatable`, which the server enforces
 * separately. A drift there is a form that offers stars the API then rejects.
 */
describe("field locks", () => {
  it("keeps progress shut only while the book is not yours yet", () => {
    expect(lockedReason("pagesRead", "WISHLIST")).toBe("bookForm.lockedProgress");

    // Bought but unstarted is deliberately open: people read before they get
    // round to moving the status.
    expect(lockedReason("pagesRead", "PURCHASED")).toBeNull();
    expect(lockedReason("pagesRead", "READING")).toBeNull();
    expect(lockedReason("pagesRead", "FINISHED")).toBeNull();
    expect(lockedReason("pagesRead", "ABANDONED")).toBeNull();
  });

  it("opens the start date the moment the book is in hand", () => {
    expect(lockedReason("startedOn", "WISHLIST")).toBe("bookForm.lockedStarted");
    expect(lockedReason("startedOn", "PURCHASED")).toBeNull();
  });

  it("keeps the finish date shut until the book has been opened", () => {
    expect(lockedReason("finishedOn", "WISHLIST")).toBe("bookForm.lockedFinished");
    expect(lockedReason("finishedOn", "PURCHASED")).toBe("bookForm.lockedFinished");

    // Abandoning is a way of finishing (§D11), and an old book typed in as read
    // years ago needs the date on the first save.
    expect(lockedReason("finishedOn", "READING")).toBeNull();
    expect(lockedReason("finishedOn", "FINISHED")).toBeNull();
    expect(lockedReason("finishedOn", "ABANDONED")).toBeNull();
  });

  it("locks what was paid before the purchase and never the estimate", () => {
    expect(lockedReason("paidPrice", "WISHLIST")).toBe("bookForm.lockedPaid");
    expect(lockedReason("paidPrice", "PURCHASED")).toBeNull();
  });

  it("locks the stars on exactly the statuses the API refuses them on", () => {
    // The one lock that is not this side's opinion: `backend/src/books/rating.ts`
    // enforces the same set, and `isRatable` is the shared answer both read.
    for (const status of STATUS_VALUES) {
      expect(lockedReason("rating", status) === null, status).toBe(isRatable(status));
    }
  });
});
