import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { lastWrite, makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookCard } from "./BookCard";

function renderCard(book: Book, onOpen = vi.fn()) {
  return { onOpen, ...renderWithQuery(<BookCard book={book} onOpen={onOpen} />) };
}

const star = () => screen.getByRole("button", { name: "Favorită" });

describe("BookCard — what the card shows (S5.4)", () => {
  it("carries the cover, the title, the author, the rating and the status", () => {
    renderCard(
      makeBook({
        title: "Dune",
        author: "Frank Herbert",
        rating: 4,
        status: "FINISHED",
        coverUrl: "/covers/book-1?v=1",
      }),
    );

    expect(screen.getByRole("button", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4 din 5 stele" })).toBeInTheDocument();
    expect(screen.getByText("Terminat")).toBeInTheDocument();
  });

  it("draws the progress bar only for a book being read", () => {
    renderCard(makeBook({ status: "READING", pagesRead: 155, totalPages: 620 }));

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("keeps the bar off a finished book, which is 100% by definition", () => {
    renderCard(makeBook({ status: "FINISHED", pagesRead: 620, totalPages: 620 }));

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("falls back to the page number when there is nothing to divide by (§D4)", () => {
    renderCard(makeBook({ status: "READING", pagesRead: 143, totalPages: null }));

    // No half-drawn bar standing in for an unknown.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("pag. 143")).toBeInTheDocument();
  });

  it("opens the book when the title is clicked", async () => {
    const { user, onOpen } = renderCard(makeBook({ title: "Dune" }));

    await user.click(screen.getByRole("button", { name: "Dune" }));

    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe("BookCard — the placeholder (S5.5)", () => {
  it("draws a cover of our own for a book without one", () => {
    renderCard(makeBook({ title: "Dune", author: "Frank Herbert", coverUrl: null }));

    // The title and author are drawn *on* the placeholder as well, which is the
    // point of S5.5: the book stays identifiable without a jacket. Two of each,
    // then — the drawn one and the card's own line beneath it.
    expect(screen.getAllByText("Dune")).toHaveLength(2);
    expect(screen.getAllByText("Frank Herbert")).toHaveLength(2);
    expect(screen.queryByRole("img", { name: "" })).not.toBeInTheDocument();
  });

  it("shows the real cover when there is one, and no placeholder", () => {
    const { container } = renderCard(
      makeBook({ title: "Dune", coverUrl: "/covers/book-1?v=1" }),
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", expect.stringContaining("/covers/book-1"));
    // Only the card's own title line remains.
    expect(screen.getAllByText("Dune")).toHaveLength(1);
  });
});

describe("BookCard — favourite (S5.2)", () => {
  it("marks a book through the ordinary edit route (§D30)", async () => {
    const calls = stubApi();
    const { user } = renderCard(makeBook({ favorite: false }));

    await user.click(star());

    const write = calls.find((call) => call.method === "PATCH");
    expect(write?.url).toContain("/books/book-1");
    expect(lastWrite(calls)).toEqual({ favorite: true });
  });

  it("unmarks one that is already a favourite", async () => {
    const calls = stubApi();
    const { user } = renderCard(makeBook({ favorite: true }));

    await user.click(star());

    expect(lastWrite(calls)).toEqual({ favorite: false });
  });

  it("says which way the toggle is set", () => {
    renderCard(makeBook({ favorite: true }));

    expect(star()).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the star on a wishlist book too (§D14)", async () => {
    const calls = stubApi();
    const { user } = renderCard(makeBook({ status: "WISHLIST", favorite: false }));

    await user.click(star());

    // Orthogonal to status: nothing about not having bought a book yet stands
    // between it and the star on its card.
    expect(lastWrite(calls)).toEqual({ favorite: true });
  });
});
