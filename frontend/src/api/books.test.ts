import { describe, expect, it } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { listParams } from "./books";

describe("listParams (S3.1, S5.3)", () => {
  it("carries the status filter through", () => {
    const query: ListBooksQuery = {
      sort: "createdAt",
      order: "desc",
      status: ["WISHLIST"],
    };

    expect(listParams(query).get("status")).toBe("WISHLIST");
  });

  it("repeats the parameter for a multi-select status (S5.3)", () => {
    // `set` would have kept the last box ticked and quietly dropped the rest;
    // the API reads a repeated `status` as the list (§D29).
    const params = listParams({
      sort: "createdAt",
      order: "desc",
      status: ["READING", "FINISHED"],
    });

    expect(params.getAll("status")).toEqual(["READING", "FINISHED"]);
  });

  it("sends the gallery's other two filters", () => {
    const params = listParams({
      sort: "createdAt",
      order: "desc",
      genre: "SCIFI",
      favorite: true,
    });

    expect(params.get("genre")).toBe("SCIFI");
    expect(params.get("favorite")).toBe("true");
  });

  it("omits a filter nobody set rather than sending an empty one", () => {
    // An unticked filter is an absent parameter, not `genre=` — §D29 relies on
    // that to keep "no filter" from meaning "match nothing".
    const params = listParams({
      sort: "createdAt",
      order: "desc",
      status: [],
    });

    expect(params.toString()).toBe("sort=createdAt&order=desc");
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
