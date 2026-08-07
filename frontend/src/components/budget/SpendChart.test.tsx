import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BudgetByMonth } from "@bookcsi/shared";
import { SpendChart } from "./SpendChart";

const NONE = { books: 0, total: 0 };

/**
 * The bars themselves are an SVG measured against a layout jsdom does not have,
 * so what is asserted here is the table view beside them — which is the same
 * data, in the same order, and the surface a screen reader actually gets.
 */
const rows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("SpendChart (S6.2)", () => {
  it("lists every month it draws, oldest first", () => {
    const data: BudgetByMonth = {
      months: [
        { month: "2026-01", spent: 120 },
        { month: "2026-02", spent: 0 },
        { month: "2026-03", spent: 60 },
      ],
      undated: NONE,
    };

    render(<SpendChart data={data} />);

    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toHaveTextContent("ianuarie 2026");
    expect(rows()[0]).toHaveTextContent("120.00");
  });

  it("keeps the empty months, which are real zeros", () => {
    // Dropping them would put January beside March at equal width and the axis
    // would stop being time (§D31).
    const data: BudgetByMonth = {
      months: [
        { month: "2026-01", spent: 120 },
        { month: "2026-02", spent: 0 },
      ],
      undated: NONE,
    };

    render(<SpendChart data={data} />);

    expect(rows()[1]).toHaveTextContent("februarie 2026");
    expect(rows()[1]).toHaveTextContent("0.00");
  });

  it("says why there is no chart rather than drawing an empty one", () => {
    render(<SpendChart data={{ months: [], undated: { books: 4, total: 200 } }} />);

    expect(screen.getByText(/Niciun grafic încă/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("reports the books it cannot draw, under the chart", () => {
    const data: BudgetByMonth = {
      months: [{ month: "2026-01", spent: 120 }],
      undated: { books: 2, total: 75 },
    };

    render(<SpendChart data={data} />);

    const note = screen.getByText(/nu apar în grafic/);
    expect(note).toHaveTextContent("2 cărți n-au");
    expect(note).toHaveTextContent("75.00 lei");
  });

  it("says nothing about undated books when there are none", () => {
    // The total says every sum is dated; repeating it here would read as a
    // rendering bug rather than as a second warning.
    render(
      <SpendChart data={{ months: [{ month: "2026-01", spent: 12 }], undated: NONE }} />,
    );

    expect(screen.queryByText(/dată de cumpărare/)).not.toBeInTheDocument();
  });

  it("still explains itself when the library has nothing at all", () => {
    render(<SpendChart data={{ months: [], undated: NONE }} />);

    expect(screen.getByText(/Niciun grafic încă/)).toBeInTheDocument();
  });
});
