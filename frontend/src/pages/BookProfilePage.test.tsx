import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import type { Book } from "@bookcsi/shared";
import { failWith, makeBook, stubApi, type ApiCall } from "../test/helpers";
import { BookProfilePage } from "./BookProfilePage";
import { GalleryPage } from "./GalleryPage";
import { WishlistPage } from "./WishlistPage";

/**
 * §D40 / §D41 — the book's own page, and the back button that has to work from
 * every direction a book can be opened from.
 *
 * The routes are real rather than stubbed. The whole question the back button
 * raises is what happens *between* two screens — the origin is written by one
 * and read by the other — so a test that rendered the profile alone would
 * check the half that was never in doubt.
 */
function renderAt(
  entry: string,
  books: Book[],
  { onDelete }: { onDelete?: () => unknown } = {},
) {
  const byId = new Map(books.map((book) => [book.id, book]));

  const calls = stubApi((call) => {
    if (call.method === "DELETE") {
      return onDelete?.() ?? undefined;
    }

    const single = /\/books\/([^/?]+)$/.exec(call.url);

    if (single !== null && call.method === "GET") {
      return byId.get(single[1]) ?? failWith(404, "Cartea nu există");
    }

    return call.url.includes("/books") ? books : null;
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<div>Biblioteca</div>} />
          <Route path="/books/:id" element={<BookProfilePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

const SYNOPSIS =
  "Pe planeta deșertică Arrakis, singura sursă de mirodenie din univers,\ntânărul Paul Atreides ajunge în mijlocul unui război pentru controlul ei.";

describe("BookProfilePage — the book itself (§D40)", () => {
  it("shows the description written on the book", async () => {
    renderAt("/books/book-1", [makeBook({ description: SYNOPSIS })]);

    expect(await screen.findByText(/Pe planeta deșertică Arrakis/)).toBeInTheDocument();
  });

  /**
   * The empty state is where the feature is explained, because there is no
   * button on this screen that could fill the field in: bookcsi fetches no
   * descriptions of its own, so the only two answers are "write one" and "ask
   * the assistant" — and nobody guesses the second.
   */
  it("points at the two ways to get one when there is none", async () => {
    renderAt("/books/book-1", [makeBook({ description: null })]);

    const empty = await screen.findByText(/n-are încă o descriere/);
    expect(empty).toHaveTextContent("Editează");
    expect(empty).toHaveTextContent("Claude");
  });

  it("lists the details the book actually has, and omits the rest", async () => {
    renderAt("/books/book-1", [
      makeBook({
        isbn: "978-606-4-00000-0",
        publisher: "Nemira",
        publicationYear: 2021,
        paidPrice: 59.9,
        volume: null,
        format: null,
      }),
    ]);

    expect(await screen.findByText("Nemira")).toBeInTheDocument();
    expect(screen.getByText("978-606-4-00000-0")).toBeInTheDocument();
    expect(screen.getByText("59.90 lei")).toBeInTheDocument();
    // A grid that printed every field would be mostly dashes: most books carry
    // a handful of these at most (§D4).
    expect(screen.queryByText("Volum")).not.toBeInTheDocument();
    expect(screen.queryByText("Format")).not.toBeInTheDocument();
  });

  it("writes the reading dates the way a Romanian reader does", async () => {
    renderAt("/books/book-1", [makeBook({ purchasedOn: "2026-07-01" })]);

    expect(await screen.findByText("01.07.2026")).toBeInTheDocument();
  });

  it("says so when the book is not there", async () => {
    renderAt("/books/gone", [makeBook({ id: "book-1" })]);

    expect(await screen.findByText(/Nu am putut încărca cartea/)).toBeInTheDocument();
  });

  it("opens the edit form on the same book", async () => {
    const { user } = renderAt("/books/book-1", [makeBook({ title: "Dune" })]);

    await user.click(await screen.findByRole("button", { name: "Editează" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Editează cartea");
    expect(screen.getByDisplayValue("Dune")).toBeInTheDocument();
  });
});

describe("BookProfilePage — the way back (§D41)", () => {
  it("names the screen the user came from", async () => {
    const { user } = renderAt("/gallery", [makeBook({ id: "book-1", title: "Dune" })]);

    await user.click(await screen.findByRole("button", { name: "Dune" }));

    expect(await screen.findByRole("link", { name: /Înapoi la galerie/ })).toBeInTheDocument();
  });

  it("actually goes back there", async () => {
    const { user } = renderAt("/gallery", [makeBook({ id: "book-1", title: "Dune" })]);

    await user.click(await screen.findByRole("button", { name: "Dune" }));
    await user.click(await screen.findByRole("link", { name: /Înapoi la galerie/ }));

    expect(await screen.findByRole("heading", { name: /Galerie/ })).toBeInTheDocument();
  });

  it("carries a different origin from a different screen", async () => {
    const { user } = renderAt("/wishlist", [
      makeBook({ id: "book-1", title: "Dune", status: "WISHLIST" }),
    ]);

    await user.click(await screen.findByRole("button", { name: "Dune" }));

    expect(await screen.findByRole("link", { name: /Înapoi la wishlist/ })).toBeInTheDocument();
  });

  /**
   * The case `navigate(-1)` gets wrong, and the reason the origin travels in
   * the history entry instead: a pasted link has no previous page inside the
   * app, so "back" has to mean somewhere in bookcsi rather than wherever the
   * browser happened to be.
   */
  it("falls back to the library when the profile was opened cold", async () => {
    renderAt("/books/book-1", [makeBook({ status: "READING" })]);

    expect(
      await screen.findByRole("link", { name: /Înapoi la bibliotecă/ }),
    ).toBeInTheDocument();
  });

  it("falls back to the wishlist for a book that lives there", async () => {
    renderAt("/books/book-1", [makeBook({ status: "WISHLIST" })]);

    expect(
      await screen.findByRole("link", { name: /Înapoi la wishlist/ }),
    ).toBeInTheDocument();
  });

  it("leaves for the origin once the book is deleted", async () => {
    const { user } = renderAt("/gallery", [makeBook({ id: "book-1", title: "Dune" })]);

    await user.click(await screen.findByRole("button", { name: "Dune" }));
    await user.click(await screen.findByRole("button", { name: "Șterge" }));
    await user.click(await screen.findByRole("button", { name: "Șterge definitiv" }));

    // Not still on a profile whose book no longer exists.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Galerie/ })).toBeInTheDocument(),
    );
  });

  it("stays put when the deletion is called off", async () => {
    const { user, calls } = renderAt("/books/book-1", [makeBook({ title: "Dune" })]);

    await user.click(await screen.findByRole("button", { name: "Șterge" }));
    await user.click(await screen.findByRole("button", { name: "Renunță" }));

    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(deletes(calls)).toHaveLength(0);
  });
});

const deletes = (calls: ApiCall[]) => calls.filter((call) => call.method === "DELETE");
