import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Shelf } from "./Shelf";
import { makeBook } from "../test/helpers";
import { renderWithQuery } from "../test/helpers";

describe("Shelf (S8.2)", () => {
  it("makes every spine a real control, reachable and named", () => {
    // The prototype drew a `div` with `cursor-pointer`: no tab stop, no click
    // handler, and a hover card no touch screen could ever summon.
    renderWithQuery(
      <Shelf
        books={[makeBook({ id: "a", title: "Dune", author: "Frank Herbert" })]}
        onOpen={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Dune, Frank Herbert" }),
    ).toBeInTheDocument();
  });

  it("opens the book on click — S8.2's 'click pe cotor'", async () => {
    const onOpen = vi.fn();
    const book = makeBook({ id: "a", title: "Dune" });

    renderWithQuery(<Shelf books={[book]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /Dune/ }));

    expect(onOpen).toHaveBeenCalledWith(book);
  });

  it("opens it from the keyboard too", async () => {
    const onOpen = vi.fn();

    renderWithQuery(<Shelf books={[makeBook({ title: "Dune" })]} onOpen={onOpen} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("names a book with no author by its title alone", () => {
    renderWithQuery(
      <Shelf books={[makeBook({ title: "Anonim", author: null })]} onOpen={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "Anonim" })).toBeInTheDocument();
  });

  it("writes the title on a thick spine and leaves a thin one bare (§D33)", () => {
    renderWithQuery(
      <Shelf
        books={[
          makeBook({ id: "thick", title: "Cartea groasă", totalPages: 900 }),
          makeBook({ id: "thin", title: "Cartea subțire", totalPages: 90 }),
        ]}
        onOpen={() => {}}
      />,
    );

    // The accessible name carries both regardless; what differs is the text
    // painted on the spine, which a 14px spine has no room for.
    const painted = screen.getAllByRole("button").map((spine) => spine.textContent);
    expect(painted).toContain("Cartea groasă");
    expect(painted).not.toContain("Cartea subțire");
  });

  it("draws a spine per book, however many rows they take", () => {
    const books = Array.from({ length: 60 }, (_, index) =>
      makeBook({ id: `book-${index}`, title: `Cartea ${index}` }),
    );

    renderWithQuery(<Shelf books={books} onOpen={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(60);
  });
});
