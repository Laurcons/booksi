import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Challenge, ChallengeSummary } from "@bookcsi/shared";
import { CATEGORY_TREE, lastWrite, makeBook, stubApi, type ApiCall } from "../test/helpers";
import { ChallengePage } from "./ChallengePage";
import { renderWithQuery } from "../test/helpers";

const SUMMARY: ChallengeSummary = {
  id: "challenge-1",
  title: "Provocarea de vară",
  description: "Șase cărți până la final de august",
  deadline: "2026-08-31",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  bookCount: 2,
  finishedCount: 1,
};

const DETAIL: Challenge = {
  id: "challenge-1",
  title: "Provocarea de vară",
  description: "Șase cărți până la final de august",
  deadline: "2026-08-31",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  books: [
    makeBook({ id: "book-1", title: "Solaris", status: "FINISHED", rating: 5 }),
    makeBook({
      id: "book-2",
      title: "Groaza",
      status: "READING",
      totalPages: 768,
      pagesRead: 310,
    }),
  ],
};

function renderChallengePage({
  challenges = [SUMMARY],
  detail = DETAIL,
  extra,
}: {
  challenges?: ChallengeSummary[];
  detail?: Challenge;
  extra?: (call: ApiCall) => unknown;
} = {}) {
  const calls = stubApi((call) => {
    // `Header` fetches the current user on every page; `null` is its own
    // "signed out" answer (see `useCurrentUser`), not a missing stub.
    if (call.url.includes("/auth/me")) return null;
    if (call.url.endsWith("/challenges") && call.method === "GET") return challenges;
    if (call.url.includes("/challenges/challenge-1/books")) return detail;
    if (call.url.includes("/challenges/challenge-1") && call.method === "GET") return detail;
    if (call.url.includes("/challenges/challenge-1") && call.method === "PATCH") return detail;
    if (call.url.includes("/books/isbn-duplicates")) return [];
    if (call.url.includes("/categories")) return CATEGORY_TREE;
    const custom = extra?.(call);
    if (custom !== undefined) return custom;
    // Any book PATCH/POST just echoes something usable back.
    return call.body ?? {};
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  renderWithQuery(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/challenge"]}>
        <ChallengePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

describe("ChallengePage", () => {
  it("shows an empty state and creates a challenge from it", async () => {
    const { user, calls } = renderChallengePage({ challenges: [] });

    expect(await screen.findByText("Nicio provocare încă")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Creează o provocare" }));
    await user.type(screen.getByLabelText("Titlu"), "Provocarea de toamnă");
    await user.type(screen.getByLabelText("Termen"), "2026-11-30");
    await user.click(screen.getByRole("button", { name: "Creează" }));

    await waitFor(() => {
      const write = lastWrite(calls.filter((c) => c.url.endsWith("/challenges")));
      expect(write).toEqual({ title: "Provocarea de toamnă", deadline: "2026-11-30" });
    });
  });

  it("renders the hero stats, the shelf, and the book list from the fetched challenge", async () => {
    renderChallengePage();

    expect(await screen.findByText("Provocarea de vară")).toBeInTheDocument();
    expect(screen.getByText("1 din 2")).toBeInTheDocument();
    // Every book appears twice: once as the shelf caption, once as the list
    // row's title — the two views of the same challenge.
    expect(screen.getAllByText("Solaris").length).toBe(2);
    expect(screen.getAllByText("Groaza").length).toBe(2);
    expect(
      screen.getByText("40% — pag. 310 din 768 · schimbă pagina"),
    ).toBeInTheDocument();
  });

  it("weighs the progress bar by pages, not by whole books", async () => {
    // Solaris (FINISHED, defaults to 620/620 — finished counts as its full
    // length regardless of tracked pagesRead) + Groaza (READING, 310/768):
    // (620 + 310) / (620 + 768) = 930 / 1388 ≈ 67%. Book-count alone would
    // have said 50%.
    renderChallengePage();

    await screen.findByText("Provocarea de vară");
    expect(screen.getByText("Pagini citite")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("930 din 1.388 pagini")).toBeInTheDocument();
    expect(screen.queryByText(/număr de pagini/)).not.toBeInTheDocument();
  });

  it("falls back to a whole-book ratio and flags the gap when no book has a page count", async () => {
    const detail: Challenge = {
      ...DETAIL,
      books: [
        makeBook({ id: "book-4", title: "Poezii", status: "FINISHED", totalPages: null }),
        makeBook({ id: "book-5", title: "Cronici", status: "WISHLIST", totalPages: null }),
      ],
    };
    renderChallengePage({ detail });

    await screen.findByText("Provocarea de vară");
    expect(screen.getByText("Cărți")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(
      screen.getByText("2 cărți nu au număr de pagini — nu intră în calculul paginilor."),
    ).toBeInTheDocument();
  });

  it("advances a book straight to reading when it already has a page count", async () => {
    const detail: Challenge = {
      ...DETAIL,
      books: [makeBook({ id: "book-3", title: "Dune", status: "PURCHASED", totalPages: 688 })],
    };
    const { user, calls } = renderChallengePage({ detail });

    await user.click(await screen.findByRole("button", { name: "Încep s-o citesc" }));

    await waitFor(() => {
      const write = lastWrite(calls.filter((c) => c.url.includes("/books/book-3")));
      expect(write).toEqual({ status: "READING" });
    });
  });

  it("bundles finish and rating in one request from the finish dialog", async () => {
    const { user, calls } = renderChallengePage();

    // Only Groaza (READING) has an "Am terminat-o" button — Solaris is
    // already FINISHED, so this is unambiguous despite both titles repeating.
    await user.click(await screen.findByRole("button", { name: "Am terminat-o" }));

    const dialog = await screen.findByRole("dialog", { name: "Ai terminat-o?" });
    await user.click(within(dialog).getByLabelText("4 stele"));
    await user.click(within(dialog).getByRole("button", { name: "Marchează terminată" }));

    await waitFor(() => {
      const write = lastWrite(calls.filter((c) => c.url.includes("/books/book-2")));
      expect(write).toEqual({ status: "FINISHED", rating: 4 });
    });
  });

  it("edits the current page inline, without opening the full book form", async () => {
    const { user, calls } = renderChallengePage();

    const trigger = await screen.findByText("40% — pag. 310 din 768 · schimbă pagina");
    await user.click(trigger);

    const input = screen.getByLabelText("Pagina curentă");
    await user.clear(input);
    await user.type(input, "400");
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    await waitFor(() => {
      const write = lastWrite(calls.filter((c) => c.url.includes("/books/book-2")));
      expect(write).toEqual({ pagesRead: 400 });
    });

    // Never touched the full edit dialog.
    expect(screen.queryByText("Editează cartea")).not.toBeInTheDocument();
  });
});
