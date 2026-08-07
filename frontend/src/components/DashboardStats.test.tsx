import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BudgetSummary, StatsOverview } from "@bookcsi/shared";
import { DashboardStats } from "./DashboardStats";
import { ReadingStats } from "./stats/ReadingStats";

const overview = (partial: Partial<StatsOverview> = {}): StatsOverview => ({
  booksFinished: 12,
  booksReading: 3,
  pagesRead: 4210,
  averageRating: 4.25,
  ...partial,
});

const month = (spent: number): BudgetSummary["month"] => ({
  month: "2026-08",
  spent,
  budget: null,
  remaining: null,
});

const figures = () =>
  screen.getAllByRole("definition").map((value) => value.textContent);

describe("DashboardStats (S8.1)", () => {
  it("shows the four figures the story names, in its order", () => {
    render(<DashboardStats stats={overview()} month={month(59.9)} />);

    expect(figures()).toEqual(["12", "3", "4.210", "59.90 lei"]);
    expect(screen.getByText("Cheltuit luna asta")).toBeInTheDocument();
  });

  it("leaves the average rating to the statistics page (§D32)", () => {
    // The prototype's fourth figure was the rating, which is S7.1's third and
    // not one of the four S8.1 asks for.
    render(<DashboardStats stats={overview()} month={month(0)} />);

    expect(screen.queryByText("Rating mediu")).not.toBeInTheDocument();
  });

  it("reads the same numbers the statistics page does", () => {
    // Not a coincidence to be maintained: both components are handed one
    // `/stats/overview` response, so there is no second computation to drift.
    const stats = overview({ booksFinished: 7, pagesRead: 1500 });

    const { unmount } = render(<DashboardStats stats={stats} month={month(0)} />);
    const dashboard = figures();
    unmount();

    render(<ReadingStats stats={stats} />);
    const page = figures();

    expect(dashboard[0]).toBe(page[0]);
    expect(dashboard[2]).toBe(page[1]);
  });
});

describe("ReadingStats (S7.1)", () => {
  it("shows books read, pages read and the average rating", () => {
    render(<ReadingStats stats={overview()} />);

    expect(figures()).toEqual(["12", "4.210", "4.3"]);
  });

  it("prints a dash, never a zero, when nothing is rated", () => {
    // No rating is an absence, not a verdict of nought — a 0 under "rating
    // mediu" would read as "you hated everything".
    render(<ReadingStats stats={overview({ averageRating: null })} />);

    expect(figures()).toEqual(["12", "4.210", "—"]);
  });

  it("does not show what is being read — that is the dashboard's figure", () => {
    render(<ReadingStats stats={overview()} />);

    expect(screen.queryByText("În curs")).not.toBeInTheDocument();
  });
});
