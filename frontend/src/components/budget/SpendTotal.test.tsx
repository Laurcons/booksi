import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpendTotal } from "./SpendTotal";
import { renderWithQuery } from "../../test/helpers";

const NONE = { books: 0, total: 0 };

describe("SpendTotal (S6.1)", () => {
  it("shows the total with two decimals, whatever it ends in", () => {
    renderWithQuery(<SpendTotal total={340.5} undated={NONE} />);

    expect(screen.getByText("340.50")).toBeInTheDocument();
    expect(screen.getByText("lei")).toBeInTheDocument();
  });

  it("shows a zero rather than an empty space for a library nobody has paid for", () => {
    renderWithQuery(<SpendTotal total={0} undated={NONE} />);

    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("says the total is fully dated when every purchase has a date", () => {
    renderWithQuery(<SpendTotal total={340.5} undated={NONE} />);

    expect(screen.getByText(/Fiecare sumă are și o dată/)).toBeInTheDocument();
  });

  it("says how much of the total has no date (S6.2)", () => {
    renderWithQuery(<SpendTotal total={340.5} undated={{ books: 3, total: 75 }} />);

    // The amount *and* the count: a count alone leaves the reader subtracting
    // two totals in their head.
    const note = screen.getByText(/dată de cumpărare/);
    expect(note).toHaveTextContent("75.00 lei");
    expect(note).toHaveTextContent("3 cărți fără");
  });

  it("uses the singular for one undated book", () => {
    renderWithQuery(<SpendTotal total={40} undated={{ books: 1, total: 40 }} />);

    expect(screen.getByText(/o carte fără/)).toBeInTheDocument();
  });
});
