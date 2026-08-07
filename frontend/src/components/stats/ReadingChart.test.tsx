import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StatsByMonth } from "@bookcsi/shared";
import { ReadingChart } from "./ReadingChart";

/**
 * The bars are an SVG measured against a layout jsdom does not have, so what is
 * asserted here is the table beside them — the same data, in the same order,
 * and the surface a screen reader actually gets.
 */
const rows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("ReadingChart (S7.2)", () => {
  it("lists every month it draws, oldest first", () => {
    const data: StatsByMonth = {
      months: [
        { month: "2026-01", finished: 3 },
        { month: "2026-02", finished: 0 },
        { month: "2026-03", finished: 1 },
      ],
      undated: 0,
    };

    render(<ReadingChart data={data} />);

    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toHaveTextContent("ianuarie 2026");
    expect(rows()[0]).toHaveTextContent("3");
  });

  it("keeps the empty months, which are real zeros", () => {
    // Same rule as S6.2: dropping them would put January beside March at equal
    // width and the axis would stop being time.
    const data: StatsByMonth = {
      months: [
        { month: "2026-01", finished: 3 },
        { month: "2026-02", finished: 0 },
      ],
      undated: 0,
    };

    render(<ReadingChart data={data} />);

    expect(rows()[1]).toHaveTextContent("februarie 2026");
    expect(rows()[1]).toHaveTextContent("0");
  });

  it("says why there is no chart rather than drawing an empty one", () => {
    render(<ReadingChart data={{ months: [], undated: 4 }} />);

    expect(screen.getByText(/Niciun grafic încă/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("counts the finished books it cannot place, under the chart (S7.2)", () => {
    const data: StatsByMonth = {
      months: [{ month: "2026-01", finished: 3 }],
      undated: 5,
    };

    render(<ReadingChart data={data} />);

    const note = screen.getByText(/nu apar în grafic/);
    expect(note).toHaveTextContent("5 cărți terminate n-au");
    // The books are missing from the chart, not from the headline figure —
    // saying so is what stops the two looking like they disagree.
    expect(note).toHaveTextContent("cărți citite");
  });

  it("says it in the singular for one book", () => {
    render(
      <ReadingChart
        data={{ months: [{ month: "2026-01", finished: 3 }], undated: 1 }}
      />,
    );

    expect(screen.getByText(/nu apare în grafic/)).toHaveTextContent(
      "o carte terminată n-are",
    );
  });

  it("says nothing about undated books when every finish has a date", () => {
    render(
      <ReadingChart
        data={{ months: [{ month: "2026-01", finished: 2 }], undated: 0 }}
      />,
    );

    expect(screen.queryByText(/dată de terminare/)).not.toBeInTheDocument();
  });
});
