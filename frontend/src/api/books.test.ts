import { describe, expect, it } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { listParams } from "./books";

describe("listParams (S3.1)", () => {
  it("carries the status filter through", () => {
    const query: ListBooksQuery = {
      sort: "createdAt",
      order: "desc",
      status: "WISHLIST",
    };

    expect(listParams(query).get("status")).toBe("WISHLIST");
  });

  it("omits the filter entirely when there is none", () => {
    // Not `status=undefined`. Spreading the query into `URLSearchParams` would
    // send that literal string, the API would match it against the five
    // statuses, and every unfiltered library load would answer 400.
    const params = listParams({ sort: "createdAt", order: "desc" });

    expect(params.has("status")).toBe(false);
    expect(params.toString()).toBe("sort=createdAt&order=desc");
  });

  it("omits it when the key is present but undefined", () => {
    // The shape an optional field actually arrives in once it is spread from
    // somewhere else — `{ ...sort, status: undefined }` is not an absent key.
    const params = listParams({
      sort: "title",
      order: "asc",
      status: undefined,
    });

    expect(params.toString()).toBe("sort=title&order=asc");
  });
});
