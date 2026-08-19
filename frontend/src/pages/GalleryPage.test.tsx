import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Book } from "@bookcsi/shared";
import { makeBook, stubApi, type ApiCall } from "../test/helpers";
import { GalleryPage } from "./GalleryPage";
import { renderWithQuery } from "../test/helpers";

/**
 * The page, its router (the header renders `NavLink`s) and a query client of
 * its own. The seam stays `fetch`, as everywhere else in this suite: what the
 * gallery *asks the API for* is half of what S5.3 is, and stubbing the hooks
 * would leave exactly that half untested.
 */
function renderGallery(books: Book[]) {
  const calls = stubApi((call) => (call.url.includes("/books") ? books : null));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  renderWithQuery(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/gallery"]}>
        <GalleryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

/** The last library request the page made, filters and all. */
const lastListUrl = (calls: ApiCall[]): string =>
  calls.filter((call) => call.url.includes("/books?")).at(-1)?.url ?? "";

describe("GalleryPage — the grid (S5.1)", () => {
  it("draws one card per book", async () => {
    renderGallery([
      makeBook({ id: "book-1", title: "Dune" }),
      makeBook({ id: "book-2", title: "Solaris" }),
    ]);

    expect(await screen.findByRole("button", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solaris" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("asks for the library newest first, with no filter", async () => {
    const { calls } = renderGallery([makeBook()]);

    await screen.findByRole("button", { name: "Dune" });

    expect(lastListUrl(calls)).toContain("sort=createdAt&order=desc");
    expect(lastListUrl(calls)).not.toContain("status=");
  });
});

describe("GalleryPage — filters on the wire (S5.3)", () => {
  it("sends a repeated status parameter for a multi-select", async () => {
    const { user, calls } = renderGallery([makeBook()]);
    await screen.findByRole("button", { name: "Dune" });

    await user.click(screen.getByRole("button", { name: "Citesc" }));
    await user.click(screen.getByRole("button", { name: "Terminat" }));

    // Repeated, not comma-joined and not overwritten: §D29.
    await waitFor(() =>
      expect(lastListUrl(calls)).toContain("status=READING&status=FINISHED"),
    );
  });

  it("sends genre and favorite alongside it", async () => {
    const { user, calls } = renderGallery([makeBook()]);
    await screen.findByRole("button", { name: "Dune" });

    await user.click(screen.getByLabelText("Categorie"));
    await user.click(screen.getByRole("button", { name: "Ficțiune" }));
    await user.click(screen.getByRole("button", { name: /Doar favoritele/ }));

    await waitFor(() => {
      expect(lastListUrl(calls)).toContain("genre=FICTION");
      expect(lastListUrl(calls)).toContain("favorite=true");
    });
  });
});

describe("GalleryPage — the two empty states", () => {
  it("asks for a first book when the library itself is empty", async () => {
    renderGallery([]);

    expect(await screen.findByText("Încă n-ai nicio carte")).toBeInTheDocument();
  });

  it("blames the filters, not the library, when a filter matched nothing", async () => {
    const { user } = renderGallery([]);
    await screen.findByText("Încă n-ai nicio carte");

    await user.click(screen.getByRole("button", { name: "Citesc" }));

    // "Încă n-ai nicio carte" would be simply false here, and its button —
    // add a book — would not bring the filtered-out ones back.
    expect(
      await screen.findByText("Nicio carte nu se potrivește"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Încă n-ai nicio carte")).not.toBeInTheDocument();
  });

  it("puts the filters back", async () => {
    const { user, calls } = renderGallery([]);
    await screen.findByText("Încă n-ai nicio carte");

    await user.click(screen.getByRole("button", { name: "Citesc" }));
    await screen.findByText("Nicio carte nu se potrivește");

    await user.click(screen.getByRole("button", { name: "Arată toate cărțile" }));

    await waitFor(() => expect(lastListUrl(calls)).not.toContain("status="));
    expect(await screen.findByText("Încă n-ai nicio carte")).toBeInTheDocument();
  });
});
