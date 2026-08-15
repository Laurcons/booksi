import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { GalleryFilters } from "./GalleryFilters";

const BASE: ListBooksQuery = { sort: "createdAt", order: "desc" };

function renderFilters(query: ListBooksQuery = BASE) {
  const onChange = vi.fn();
  render(<GalleryFilters query={query} onChange={onChange} />);

  return { user: userEvent.setup(), onChange };
}

/** The query the component last asked for. */
const asked = (onChange: ReturnType<typeof vi.fn>): ListBooksQuery =>
  onChange.mock.calls.at(-1)?.[0] as ListBooksQuery;

describe("GalleryFilters — status (S5.3)", () => {
  it("adds a status to the filter", async () => {
    const { user, onChange } = renderFilters();

    await user.click(screen.getByRole("button", { name: "Citesc" }));

    expect(asked(onChange).status).toEqual(["READING"]);
  });

  it("accumulates statuses rather than replacing them — the filter is multi-select", async () => {
    const { user, onChange } = renderFilters({ ...BASE, status: ["READING"] });

    await user.click(screen.getByRole("button", { name: "Terminat" }));

    expect(asked(onChange).status).toEqual(["READING", "FINISHED"]);
  });

  it("removes one that was already on", async () => {
    const { user, onChange } = renderFilters({
      ...BASE,
      status: ["READING", "FINISHED"],
    });

    await user.click(screen.getByRole("button", { name: "Citesc" }));

    expect(asked(onChange).status).toEqual(["FINISHED"]);
  });

  it("drops the parameter entirely when the last status is unticked", async () => {
    // Not `[]`. An empty list would ask the API for the books whose status is
    // one of none, and an empty gallery reads as data loss (§D29).
    const { user, onChange } = renderFilters({ ...BASE, status: ["READING"] });

    await user.click(screen.getByRole("button", { name: "Citesc" }));

    expect(asked(onChange).status).toBeUndefined();
  });

  it("shows which statuses are on", () => {
    renderFilters({ ...BASE, status: ["READING"] });

    expect(screen.getByRole("button", { name: "Citesc" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Terminat" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("GalleryFilters — category and favourites (S5.3, §D39)", () => {
  it("filters by a single category (§D17)", async () => {
    const { user, onChange } = renderFilters();

    await user.click(screen.getByLabelText("Categorie"));
    await user.click(screen.getByRole("button", { name: "Ficțiune" }));

    expect(asked(onChange).genre).toBe("FICTION");
  });

  it("clears the category back to all of them", async () => {
    const { user, onChange } = renderFilters({ ...BASE, genre: "FICTION" });

    await user.click(screen.getByLabelText("Categorie"));
    await user.click(screen.getByRole("button", { name: "Toate categoriile" }));

    expect(asked(onChange).genre).toBeUndefined();
  });

  it("turns the favourites filter on", async () => {
    const { user, onChange } = renderFilters();

    await user.click(screen.getByRole("button", { name: /Doar favoritele/ }));

    expect(asked(onChange).favorite).toBe(true);
  });

  it("turns it off by dropping the parameter, not by asking for false", async () => {
    // `favorite=false` is a legitimate filter — the books that are *not*
    // favourites — so it cannot double as "no filter" (§D29).
    const { user, onChange } = renderFilters({ ...BASE, favorite: true });

    await user.click(screen.getByRole("button", { name: /Doar favoritele/ }));

    expect(asked(onChange).favorite).toBeUndefined();
  });

  it("combines the three without dropping any of them", async () => {
    const { user, onChange } = renderFilters({
      ...BASE,
      status: ["FINISHED"],
      genre: "FICTION",
    });

    await user.click(screen.getByRole("button", { name: /Doar favoritele/ }));

    expect(asked(onChange)).toMatchObject({
      status: ["FINISHED"],
      genre: "FICTION",
      favorite: true,
      // The sort survives a filter change; they are separate concerns.
      sort: "createdAt",
      order: "desc",
    });
  });
});

describe("GalleryFilters — clearing", () => {
  it("offers no reset when nothing is filtered", () => {
    renderFilters();

    expect(
      screen.queryByRole("button", { name: "Șterge filtrele" }),
    ).not.toBeInTheDocument();
  });

  it("clears all three at once", async () => {
    const { user, onChange } = renderFilters({
      ...BASE,
      status: ["READING"],
      genre: "FICTION",
      favorite: true,
    });

    await user.click(screen.getByRole("button", { name: "Șterge filtrele" }));

    expect(asked(onChange)).toEqual({ ...BASE });
  });
});
