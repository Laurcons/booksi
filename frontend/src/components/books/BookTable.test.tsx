import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book, ListBooksQuery } from "@bookcsi/shared";
import { lastWrite, makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookTable } from "./BookTable";

const QUERY: ListBooksQuery = { sort: "createdAt", order: "desc" };

function renderTable(books: Book[], price?: "paid" | "estimated") {
  return renderWithQuery(
    <BookTable
      books={books}
      query={QUERY}
      onQueryChange={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      price={price}
    />,
  );
}

/** The cell under the "Pagini" header, whatever it currently holds. */
function pagesCell(): HTMLElement {
  const row = screen.getAllByRole("row")[1];
  return within(row).getAllByRole("cell")[4];
}

/** The money cell, whichever of §D6's two prices the view is showing. */
function priceCell(): HTMLElement {
  const row = screen.getAllByRole("row")[1];
  return within(row).getAllByRole("cell")[5];
}

describe("BookTable — progress (S2.2)", () => {
  it("draws a bar and a fraction for a book being read", () => {
    renderTable([makeBook({ status: "READING", pagesRead: 155, totalPages: 620 })]);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(pagesCell()).toHaveTextContent("155/620");
  });

  it("shows the page alone, with no bar, when the page count is missing (§D4)", () => {
    // The frequent case for non-English editions — a percentage would have to
    // be invented, so none is shown.
    renderTable([makeBook({ status: "READING", pagesRead: 143, totalPages: null })]);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(pagesCell()).toHaveTextContent("pag. 143");
    expect(pagesCell()).not.toHaveTextContent("%");
  });

  it("keeps the bar off books nobody is reading", () => {
    // docs/DESIGN.md: the bar belongs to `Citesc`. A finished book is at 100%
    // by definition and a wishlist entry has nothing to show.
    renderTable([
      makeBook({ id: "a", status: "FINISHED", pagesRead: 620, totalPages: 620 }),
      makeBook({ id: "b", status: "WISHLIST", pagesRead: 0, totalPages: 300 }),
    ]);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not let a page count from another edition overflow the bar (§D7)", () => {
    renderTable([makeBook({ status: "READING", pagesRead: 700, totalPages: 300 })]);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    // The reader's own number is still shown, unclamped — it is their data.
    expect(pagesCell()).toHaveTextContent("700/300");
  });
});

describe("BookTable — rating and price (S2.3, S2.4)", () => {
  it("shows the rating as stars", () => {
    renderTable([makeBook({ status: "FINISHED", rating: 4 })]);

    expect(screen.getByRole("img", { name: "4 din 5 stele" })).toBeInTheDocument();
  });

  it("shows the paid price with two decimals", () => {
    renderTable([makeBook({ paidPrice: 59.9 })]);

    expect(screen.getByText("59.90")).toBeInTheDocument();
  });
});

describe("BookTable — starting a book (S2.2)", () => {
  it("asks for the page count when it is missing", async () => {
    const calls = stubApi();
    const { user } = renderTable([
      makeBook({ status: "PURCHASED", totalPages: null }),
    ]);

    await user.click(screen.getByRole("button", { name: "Încep s-o citesc" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Nothing is saved until the question is answered one way or the other.
    expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
  });

  it("does not ask when the book already has a page count", async () => {
    const calls = stubApi();
    const { user } = renderTable([makeBook({ status: "PURCHASED", totalPages: 620 })]);

    await user.click(screen.getByRole("button", { name: "Încep s-o citesc" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(lastWrite(calls)).toEqual({ status: "READING" });
  });

  it("does not ask on any other transition", async () => {
    // A book being finished is not the moment to want a page count.
    const calls = stubApi();
    const { user } = renderTable([makeBook({ status: "READING", totalPages: null })]);

    await user.click(screen.getByRole("button", { name: "Am terminat-o" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(lastWrite(calls)).toEqual({ status: "FINISHED" });
  });
});

describe("BookTable — the wishlist's price column (S3.1, S3.2)", () => {
  it("shows what was paid in the library", () => {
    renderTable([makeBook({ paidPrice: 45, estimatedPrice: 59.9 })]);

    expect(priceCell()).toHaveTextContent("45.00");
    expect(screen.getByRole("columnheader", { name: "Preț" })).toBeInTheDocument();
  });

  it("shows the estimate in the wishlist instead", () => {
    // A wishlist book has not been paid for, so the library's column would be
    // a row of dashes — same table, different question.
    renderTable(
      [makeBook({ status: "WISHLIST", paidPrice: null, estimatedPrice: 59.9 })],
      "estimated",
    );

    expect(priceCell()).toHaveTextContent("59.90");
    expect(
      screen.getByRole("columnheader", { name: "Preț estimat" }),
    ).toBeInTheDocument();
  });

  it("dashes a book nobody has priced, rather than showing 0", () => {
    // S3.2 makes the estimate optional; "I haven't decided" is not "free".
    renderTable([makeBook({ status: "WISHLIST", estimatedPrice: null })], "estimated");

    expect(priceCell()).toHaveTextContent("—");
    expect(priceCell()).not.toHaveTextContent("0.00");
  });
});

describe("BookTable — buying a book (S3.4)", () => {
  it("takes one click, on its own route", async () => {
    // Not a PATCH: the status, the date and the price move together, and
    // copying the estimate into what was paid is the server's rule (§D6).
    const calls = stubApi(() => makeBook({ status: "PURCHASED" }));
    const { user } = renderTable([
      makeBook({ status: "WISHLIST", estimatedPrice: 59.9 }),
    ]);

    await user.click(screen.getByRole("button", { name: "Am cumpărat-o" }));

    const write = calls.filter((call) => call.method !== "GET").at(-1);
    expect(write?.method).toBe("POST");
    expect(write?.url).toMatch(/\/books\/book-1\/purchase$/);
    // Nothing is re-entered — the request carries no body at all.
    expect(write?.body).toBeUndefined();
  });

  it("asks nothing first", async () => {
    // "Fără modal" is in the story. The one dialog this table can raise belongs
    // to starting a book, not to buying one.
    stubApi(() => makeBook({ status: "PURCHASED" }));
    const { user } = renderTable([
      makeBook({ status: "WISHLIST", totalPages: null }),
    ]);

    await user.click(screen.getByRole("button", { name: "Am cumpărat-o" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not block on a book with no estimate", async () => {
    const calls = stubApi(() => makeBook({ status: "PURCHASED" }));
    const { user } = renderTable([
      makeBook({ status: "WISHLIST", estimatedPrice: null }),
    ]);

    await user.click(screen.getByRole("button", { name: "Am cumpărat-o" }));

    expect(
      calls.filter((call) => call.url.includes("/purchase")),
    ).toHaveLength(1);
  });

  it("leaves every other transition a PATCH", async () => {
    const calls = stubApi();
    const { user } = renderTable([makeBook({ status: "READING", totalPages: 620 })]);

    await user.click(screen.getByRole("button", { name: "Am terminat-o" }));

    expect(calls.filter((call) => call.url.includes("/purchase"))).toHaveLength(0);
    expect(lastWrite(calls)).toEqual({ status: "FINISHED" });
  });
});
