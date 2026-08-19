import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { makeBook, renderWithQuery, stubApi, type ApiCall } from "../../test/helpers";
import { BookSelector } from "./BookSelector";

const LIBRARY: Book[] = [
  makeBook({ id: "book-1", title: "Dune", author: "Frank Herbert" }),
  makeBook({ id: "book-2", title: "Solaris", author: "Stanisław Lem" }),
  makeBook({ id: "book-3", title: "Circe", author: "Madeline Miller" }),
];

/**
 * §D42 — the search is the API's now, so the stub has to answer like the API:
 * it reads `q` off the URL and narrows. A stub that returned the whole library
 * whatever was asked would let a component that dropped the parameter pass.
 *
 * The matching here is deliberately cruder than the server's (title and author,
 * one term) — it only has to prove the parameter arrives and its answer is
 * what gets drawn.
 */
function respond(call: ApiCall): Book[] | null {
  if (!call.url.includes("/books?")) {
    return null;
  }

  const q = new URL(call.url, "http://localhost").searchParams.get("q");
  if (q === null) {
    return LIBRARY;
  }

  const needle = q.toLowerCase();
  return LIBRARY.filter(
    (book) =>
      book.title.toLowerCase().includes(needle) ||
      (book.author ?? "").toLowerCase().includes(needle),
  );
}

function renderSelector(selectedIds: ReadonlySet<string> = new Set()) {
  const calls = stubApi(respond);
  const onToggle = vi.fn();

  renderWithQuery(<BookSelector selectedIds={selectedIds} onToggle={onToggle} />);

  return { user: userEvent.setup(), onToggle, calls };
}

/** The last library request the selector made. */
const lastListUrl = (calls: ApiCall[]): string =>
  calls.filter((call) => call.url.includes("/books?")).at(-1)?.url ?? "";

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

  it("asks the API to search rather than filtering the loaded list (§D42)", async () => {
    const { user, calls } = renderSelector();
    await screen.findByText("Dune");

    // "Lem" only matches Solaris's author.
    await user.type(screen.getByLabelText("Caută cărți"), "lem");

    await waitFor(() => {
      expect(screen.queryByText("Dune")).not.toBeInTheDocument();
      expect(screen.queryByText("Circe")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Solaris")).toBeInTheDocument();
    // The parameter, not a client-side pass: this is what buys the publisher,
    // the ISBN, the description and diacritic folding, none of which
    // `toLowerCase().includes()` could do.
    expect(lastListUrl(calls)).toContain("q=lem");
  });

  it("asks for the whole library while the box is empty", async () => {
    const { calls } = renderSelector();
    await screen.findByText("Dune");

    expect(lastListUrl(calls)).not.toContain("q=");
  });

  it("sends one request per pause, not one per keystroke", async () => {
    const { user, calls } = renderSelector();
    await screen.findByText("Dune");

    const before = calls.filter((call) => call.url.includes("/books?")).length;
    await user.type(screen.getByLabelText("Caută cărți"), "lem");
    await waitFor(() => expect(lastListUrl(calls)).toContain("q=lem"));

    // Three letters typed; the debounce must not have bought three round trips.
    const after = calls.filter((call) => call.url.includes("/books?")).length;
    expect(after - before).toBeLessThan(3);
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
