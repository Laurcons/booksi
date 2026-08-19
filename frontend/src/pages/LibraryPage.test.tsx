import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Book } from "@bookcsi/shared";
import { makeBook, stubApi, type ApiCall } from "../test/helpers";
import { LibraryPage } from "./LibraryPage";

/**
 * §D42 — the search box on the table, and the two things around it that are
 * easy to get wrong: what the API is asked for, and which empty state the page
 * shows when the answer is nothing.
 *
 * The seam is `fetch`, as everywhere else in this suite. The dashboard's two
 * requests are answered with real-shaped figures rather than left to fail —
 * `Dashboard` renders nothing until both arrive, so a null would only hide it,
 * and a hidden band is not what these tests are about.
 */
const OVERVIEW = {
  booksFinished: 3,
  booksReading: 1,
  pagesRead: 900,
  averageRating: 4.5,
};

const BUDGET = {
  total: 500,
  month: { month: "2026-08", spent: 100, budget: 250, remaining: 150 },
};

function renderLibrary(answer: (q: string | null) => Book[]) {
  const calls = stubApi((call) => {
    if (call.url.includes("/stats/overview")) {
      return OVERVIEW;
    }
    if (call.url.includes("/budget/summary")) {
      return BUDGET;
    }
    if (call.url.includes("/books?")) {
      return answer(new URL(call.url, "http://localhost").searchParams.get("q"));
    }
    return null;
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <LibraryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

/** The last library request the page made. */
const lastListUrl = (calls: ApiCall[]): string =>
  calls.filter((call) => call.url.includes("/books?")).at(-1)?.url ?? "";

const LIBRARY = [
  makeBook({ id: "book-1", title: "Dune", author: "Frank Herbert" }),
  makeBook({ id: "book-2", title: "Solaris", author: "Stanisław Lem" }),
];

describe("LibraryPage — search (§D42)", () => {
  it("asks the API for the search rather than filtering what it holds", async () => {
    const { user, calls } = renderLibrary((q) =>
      q === null ? LIBRARY : LIBRARY.filter((book) => book.title === "Solaris"),
    );
    await screen.findByText("Dune");

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "lem");

    await waitFor(() => expect(lastListUrl(calls)).toContain("q=lem"));
    expect(await screen.findByText("Solaris")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("sends nothing while the box is empty", async () => {
    const { calls } = renderLibrary(() => LIBRARY);
    await screen.findByText("Dune");

    expect(lastListUrl(calls)).not.toContain("q=");
  });

  it("keeps the search when the table is re-sorted", async () => {
    // The header used to rebuild the query from the sort alone. A click here
    // would have dropped `q` and silently returned the whole library under a
    // search box that still had text in it.
    const { user, calls } = renderLibrary((q) =>
      q === null ? LIBRARY : LIBRARY.filter((book) => book.title === "Solaris"),
    );
    await screen.findByText("Dune");

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "lem");
    await waitFor(() => expect(lastListUrl(calls)).toContain("q=lem"));

    await user.click(screen.getByRole("button", { name: /Titlu/ }));

    await waitFor(() => expect(lastListUrl(calls)).toContain("sort=title"));
    expect(lastListUrl(calls)).toContain("q=lem");
  });

  it("says the search found nothing — not that the library is empty", async () => {
    // The two absences are different and the buttons under them are different:
    // one offers a first book, the other gives the search back (§D29).
    const { user } = renderLibrary((q) => (q === null ? LIBRARY : []));
    await screen.findByText("Dune");

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "zzzz");

    expect(await screen.findByText("Nicio carte nu se potrivește")).toBeInTheDocument();
    expect(screen.queryByText(/Biblioteca ta e goală/)).not.toBeInTheDocument();
  });

  it("brings the books back when that message's button is pressed", async () => {
    const { user } = renderLibrary((q) => (q === null ? LIBRARY : []));
    await screen.findByText("Dune");

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "zzzz");
    await screen.findByText("Nicio carte nu se potrivește");

    await user.click(screen.getByRole("button", { name: "Arată toate cărțile" }));

    expect(await screen.findByText("Dune")).toBeInTheDocument();
    // The box empties too — a cleared search still showing its words is a lie
    // about what is on screen.
    expect(screen.getByLabelText("Caută în bibliotecă")).toHaveValue("");
  });

  it("shows the ordinary empty state when the library really is empty", async () => {
    renderLibrary(() => []);

    // No search typed, so this is the "add your first book" case, and the
    // "nothing matches" copy must not appear.
    await waitFor(() =>
      expect(screen.queryByText("Nicio carte nu se potrivește")).not.toBeInTheDocument(),
    );
  });

  it("stops claiming what the shelf holds while a search is on", async () => {
    // "Ai o carte începută" counts the rows on screen. Under a search those
    // are the results, not the library, and the sentence would be a fact about
    // the wrong set.
    const { user } = renderLibrary((q) =>
      q === null ? LIBRARY : LIBRARY.filter((book) => book.title === "Solaris"),
    );
    await screen.findByText(/carte începută|cărți începute/);

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "lem");

    await waitFor(() =>
      expect(screen.queryByText(/carte începută|cărți începute/)).not.toBeInTheDocument(),
    );
  });
});
