import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BudgetSummary } from "@bookcsi/shared";
import { lastWrite, renderWithQuery, stubApi } from "../../test/helpers";
import { MonthBudget } from "./MonthBudget";

type Month = BudgetSummary["month"];

const month = (overrides: Partial<Month> = {}): Month => ({
  month: "2026-08",
  spent: 59.9,
  budget: 120,
  remaining: 60.1,
  ...overrides,
});

const renderMonth = (value: Month = month()) =>
  renderWithQuery(<MonthBudget month={value} />);

const field = () => screen.getByLabelText("Buget lunar");
const save = () => screen.getByRole("button", { name: "Salvează" });

describe("MonthBudget — the figures (S6.3)", () => {
  it("names the month it is talking about", () => {
    renderMonth();

    expect(screen.getByText("august 2026")).toBeInTheDocument();
  });

  it("shows what was spent and what is left of the budget", () => {
    renderMonth();

    expect(screen.getByText("59.90")).toBeInTheDocument();
    expect(screen.getByText(/Ți-au mai rămas/)).toHaveTextContent("60.10 lei");
  });

  it("says the overspend in words and in figures, never in colour alone", () => {
    renderMonth(month({ spent: 150, remaining: -30 }));

    const line = screen.getByText(/Ai depășit bugetul/);
    expect(line).toHaveTextContent("30.00 lei");
    // Overspending warns; it never blocks (S6.3).
    expect(save()).toBeEnabled();
  });

  it("still reports the spending when no budget was ever set", () => {
    renderMonth(month({ budget: null, remaining: null }));

    expect(screen.getByText("59.90")).toBeInTheDocument();
    expect(screen.getByText(/Pune-ți un buget/)).toBeInTheDocument();
  });

  it("starts the field from the stored budget, and empty when there is none", () => {
    const { unmount } = renderMonth();
    expect(field()).toHaveValue("120.00");

    unmount();
    renderMonth(month({ budget: null, remaining: null }));
    expect(field()).toHaveValue("");
  });
});

describe("MonthBudget — saving (S6.3)", () => {
  it("sends the amount the user typed", async () => {
    const calls = stubApi();
    const { user } = renderMonth(month({ budget: null, remaining: null }));

    await user.type(field(), "150");
    await user.click(save());

    const write = calls.find((call) => call.method === "PUT");
    expect(write?.url).toContain("/settings");
    expect(lastWrite(calls)).toEqual({ monthlyBudget: 150 });
  });

  it("clears the budget when the field is emptied", async () => {
    // Opting back out has to be reachable, and it is the same request (§D31).
    const calls = stubApi();
    const { user } = renderMonth();

    await user.clear(field());
    await user.click(save());

    expect(lastWrite(calls)).toEqual({ monthlyBudget: null });
  });

  it("refuses a third decimal with the API's own sentence, before sending it", async () => {
    const calls = stubApi();
    const { user } = renderMonth(month({ budget: null, remaining: null }));

    await user.type(field(), "12.345");
    await user.click(save());

    expect(screen.getByText("Cel mult două zecimale")).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(0);
  });

  it("refuses a negative budget", async () => {
    const calls = stubApi();
    const { user } = renderMonth(month({ budget: null, remaining: null }));

    await user.type(field(), "-10");
    await user.click(save());

    expect(screen.getByText("Suma nu poate fi negativă")).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(0);
  });

  it("asks for a number when the field holds something else", async () => {
    const calls = stubApi();
    const { user } = renderMonth(month({ budget: null, remaining: null }));

    await user.type(field(), "o sută");
    await user.click(save());

    expect(screen.getByText(/Scrie o sumă/)).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(0);
  });
});
