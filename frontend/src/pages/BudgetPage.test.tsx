import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { BudgetByMonth, BudgetSummary } from "@bookcsi/shared";
import { failWith, lastWrite, stubApi, type ApiCall } from "../test/helpers";
import { BudgetPage } from "./BudgetPage";
import { renderWithQuery } from "../test/helpers";

const SUMMARY: BudgetSummary = {
  total: 340.5,
  month: { month: "2026-08", spent: 59.9, budget: 120, remaining: 60.1 },
  undated: { books: 0, total: 0 },
};

const BY_MONTH: BudgetByMonth = {
  months: [
    { month: "2026-07", spent: 280.6, top: [], others: 0 },
    { month: "2026-08", spent: 59.9, top: [], others: 0 },
  ],
  undated: { books: 0, total: 0 },
};

function renderBudget({
  summary = SUMMARY as BudgetSummary | ReturnType<typeof failWith>,
  byMonth = BY_MONTH as BudgetByMonth | ReturnType<typeof failWith>,
}: {
  summary?: BudgetSummary | ReturnType<typeof failWith>;
  byMonth?: BudgetByMonth | ReturnType<typeof failWith>;
} = {}) {
  const calls = stubApi((call) => {
    if (call.url.includes("/budget/summary")) return summary;
    if (call.url.includes("/budget/by-month")) return byMonth;
    if (call.url.includes("/settings")) return { monthlyBudget: 150 };
    return null;
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  renderWithQuery(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/budget"]}>
        <BudgetPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

const requested = (calls: ApiCall[], path: string) =>
  calls.filter((call) => call.url.includes(path));

describe("BudgetPage — the numbers (S6.1, S6.3)", () => {
  it("shows the all-time total and the month's spending", async () => {
    renderBudget();

    expect(await screen.findByText("340.50")).toBeInTheDocument();
    // August's spending appears twice on this page — as the month's figure and
    // as its bar in the table view — which is the two views agreeing, not a
    // duplicate.
    expect(screen.getAllByText("59.90")).toHaveLength(2);
    expect(screen.getByText(/Ți-au mai rămas/)).toHaveTextContent("60.10 lei");
  });

  it("takes both figures from one request, so they cannot name different months", async () => {
    const { calls } = renderBudget();
    await screen.findByText("340.50");

    expect(requested(calls, "/budget/summary")).toHaveLength(1);
  });

  it("draws the chart from the months the API already made dense", async () => {
    renderBudget();

    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("iulie 2026");
    expect(table).toHaveTextContent("280.60");
  });
});

describe("BudgetPage — saving a budget (S6.3)", () => {
  it("sends the new limit and refetches the figures that depend on it", async () => {
    const { user, calls } = renderBudget();
    await screen.findByText("340.50");

    const field = screen.getByLabelText("Buget lunar");
    await user.clear(field);
    await user.type(field, "150");
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    expect(lastWrite(calls)).toEqual({ monthlyBudget: 150 });
    // `remaining` is computed from the limit that just changed, so a cached
    // summary would go on subtracting from the old one.
    await waitFor(() =>
      expect(requested(calls, "/budget/summary").length).toBeGreaterThan(1),
    );
  });
});

describe("BudgetPage — failures", () => {
  it("offers a retry when the figures do not load", async () => {
    renderBudget({ summary: failWith(500, "Ceva n-a mers") });

    expect(
      await screen.findByRole("button", { name: "Încearcă din nou" }),
    ).toBeInTheDocument();
  });

  it("keeps the figures when only the chart fails", async () => {
    // Two requests, so half a page is still a useful page.
    renderBudget({ byMonth: failWith(500, "Ceva n-a mers") });

    expect(await screen.findByText("340.50")).toBeInTheDocument();
    expect(screen.getByText(/Nu am putut încărca graficul/)).toBeInTheDocument();
  });
});
