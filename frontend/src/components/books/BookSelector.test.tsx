import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookSelector } from "./BookSelector";

const LIBRARY: Book[] = [
  makeBook({ id: "book-1", title: "Dune", author: "Frank Herbert" }),
  makeBook({ id: "book-2", title: "Solaris", author: "Stanisław Lem" }),
  makeBook({ id: "book-3", title: "Circe", author: "Madeline Miller" }),
];

function renderSelector(selectedIds: ReadonlySet<string> = new Set()) {
  stubApi((call) => (call.url.includes("/books?") ? LIBRARY : null));
  const onToggle = vi.fn();

  renderWithQuery(<BookSelector selectedIds={selectedIds} onToggle={onToggle} />);

  return { user: userEvent.setup(), onToggle };
}

describe("BookSelector", () => {
  it("lists every book in the library, unchecked by default", async () => {
    renderSelector();

    expect(await screen.findByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Solaris")).toBeInTheDocument();
    expect(screen.getByText("Circe")).toBeInTheDocument();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
  });

  it("reflects selectedIds as checked", async () => {
    renderSelector(new Set(["book-2"]));
    await screen.findByText("Solaris");

    // Table view renders one row per book, in the fetched (title) order.
    const rows = screen.getAllByRole("checkbox");
    expect(rows[0]).not.toBeChecked();
    expect(rows[1]).toBeChecked();
    expect(rows[2]).not.toBeChecked();
  });

  it("calls onToggle with the book, not just its id, when checked", async () => {
    const { user, onToggle } = renderSelector();
    await screen.findByText("Dune");

    await user.click(screen.getAllByRole("checkbox")[0]);

    expect(onToggle).toHaveBeenCalledWith(LIBRARY[0]);
  });

  it("filters by title or author as you type", async () => {
    const { user } = renderSelector();
    await screen.findByText("Dune");

    // "Lem" only matches Solaris's author.
    await user.type(screen.getByLabelText("Caută cărți"), "lem");

    await waitFor(() => {
      expect(screen.queryByText("Dune")).not.toBeInTheDocument();
      expect(screen.queryByText("Circe")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Solaris")).toBeInTheDocument();
  });

  it("switches to the gallery view without losing the selection", async () => {
    const { user } = renderSelector(new Set(["book-3"]));
    await screen.findByText("Dune");

    await user.click(screen.getByRole("button", { name: "Galerie" }));

    // The gallery card's checkbox is visually hidden (`sr-only`) but still
    // present and still reflects the same `selectedIds`. "Circe" now appears
    // twice per card — the placeholder cover and the caption below it.
    expect(await screen.findAllByText("Circe")).toHaveLength(2);
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes.some((box) => box.checked)).toBe(true);
  });

  it("shows an empty message instead of an empty list when nothing matches", async () => {
    const { user } = renderSelector();
    await screen.findByText("Dune");

    await user.type(screen.getByLabelText("Caută cărți"), "zzz-nimic");

    expect(await screen.findByText(/Nimic pentru/)).toBeInTheDocument();
  });
});
