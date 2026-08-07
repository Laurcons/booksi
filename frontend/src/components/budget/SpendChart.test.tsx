import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BudgetByMonth, BudgetMonth, MonthPurchase } from "@bookcsi/shared";
import { SpendChart, SpendTooltip } from "./SpendChart";

const NONE = { books: 0, total: 0 };

/** A month with nothing named in it, which is most of what these tests need. */
function month(
  month: string,
  spent: number,
  top: MonthPurchase[] = [],
  others = 0,
): BudgetMonth {
  return { month, spent, top, others };
}

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
        month("2026-01", 120),
        month("2026-02", 0),
        month("2026-03", 60),
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
        month("2026-01", 120),
        month("2026-02", 0),
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
      months: [month("2026-01", 120)],
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
      <SpendChart data={{ months: [month("2026-01", 12)], undated: NONE }} />,
    );

    expect(screen.queryByText(/dată de cumpărare/)).not.toBeInTheDocument();
  });

  it("still explains itself when the library has nothing at all", () => {
    render(<SpendChart data={{ months: [], undated: NONE }} />);

    expect(screen.getByText(/Niciun grafic încă/)).toBeInTheDocument();
  });

  it("names the unit once rather than on every tick", () => {
    render(
      <SpendChart data={{ months: [month("2026-01", 12)], undated: NONE }} />,
    );

    // The axis ticks are inside the `aria-hidden` SVG and have no layout in
    // jsdom; what matters is that the caption naming the unit is on the page.
    expect(screen.getAllByText("lei").length).toBeGreaterThan(0);
  });
});

/**
 * The tooltip is asserted directly. Recharts only builds one in response to a
 * pointer event over an SVG measured against a layout jsdom does not have, so
 * driving it through the chart would test the mock, not the component.
 */
describe("SpendChart — the month tooltip", () => {
  const render1 = (entry: BudgetMonth) =>
    render(
      <SpendTooltip
        active
        label={entry.month}
        payload={[{ value: entry.spent, payload: entry }]}
      />,
    );

  it("names the month's dearest purchases under the total", () => {
    render1(
      month("2026-01", 210, [
        { title: "Gödel, Escher, Bach", paidPrice: 120 },
        { title: "Solaris", paidPrice: 60 },
        { title: "Maitreyi", paidPrice: 30 },
      ]),
    );

    expect(screen.getByText("ianuarie 2026")).toBeInTheDocument();
    expect(screen.getByText(/210.00/)).toBeInTheDocument();
    expect(screen.getByText("Gödel, Escher, Bach")).toBeInTheDocument();
    expect(screen.getByText("120.00")).toBeInTheDocument();
  });

  it("counts what it did not name, rather than implying three is all there was", () => {
    render1(
      month("2026-01", 400, [{ title: "Solaris", paidPrice: 60 }], 4),
    );

    expect(screen.getByText(/și încă 4 cărți/)).toBeInTheDocument();
  });

  it("says nothing extra when the month is fully named", () => {
    render1(month("2026-01", 60, [{ title: "Solaris", paidPrice: 60 }]));

    expect(screen.queryByText(/și încă/)).not.toBeInTheDocument();
  });

  it("holds up for a month nobody bought anything in", () => {
    // A real zero in a dense series (§D31) — total, no list, no count.
    render1(month("2026-02", 0));

    expect(screen.getByText("februarie 2026")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
