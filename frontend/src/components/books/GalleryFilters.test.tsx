import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ListBooksQuery } from "@bookcsi/shared";
import { GalleryFilters } from "./GalleryFilters";
import { renderWithQuery } from "../../test/helpers";

const BASE: ListBooksQuery = { sort: "createdAt", order: "desc" };

function renderFilters(query: ListBooksQuery = BASE, search = "") {
  const onChange = vi.fn();
  const onSearchChange = vi.fn();
  renderWithQuery(
    <GalleryFilters
      query={query}
      onChange={onChange}
      search={search}
      onSearchChange={onSearchChange}
    />,
  );

  return { user: userEvent.setup(), onChange, onSearchChange };
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

describe("GalleryFilters — category and favourites (S5.3, §D45)", () => {
  it("filters by a single category — a leaf, never the group heading (§D45)", async () => {
    const { user, onChange } = renderFilters();

    await user.click(screen.getByLabelText("Categorie"));
    // The group "Ficțiune" is a heading, not a button; its shelves are.
    expect(screen.queryByRole("button", { name: "Ficțiune" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "SF" }));

    expect(asked(onChange).category).toEqual(["FICTION__SF"]);
  });

  it("accumulates categories rather than replacing them (§D45)", async () => {
    const { user, onChange } = renderFilters({ ...BASE, category: ["FICTION__SF"] });

    await user.click(screen.getByLabelText("Categorie"));
    await user.click(screen.getByRole("button", { name: "Fantasy" }));

    expect(asked(onChange).category).toEqual(["FICTION__SF", "FICTION__FANTASY"]);
  });

  it("removes one via its chip, dropping the parameter when the last goes (§D29)", async () => {
    const { user, onChange } = renderFilters({ ...BASE, category: ["FICTION__SF"] });

    await user.click(screen.getByRole("button", { name: "Elimină SF" }));

    expect(asked(onChange).category).toBeUndefined();
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
      category: ["FICTION__SF"],
    });

    await user.click(screen.getByRole("button", { name: /Doar favoritele/ }));

    expect(asked(onChange)).toMatchObject({
      status: ["FINISHED"],
      category: ["FICTION__SF"],
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
      category: ["FICTION__SF"],
      favorite: true,
    });

    await user.click(screen.getByRole("button", { name: "Șterge filtrele" }));

    expect(asked(onChange)).toEqual({ ...BASE });
  });
});

describe("GalleryFilters — search (§D42)", () => {
  it("shows the text it is given rather than keeping its own", () => {
    // The page owns the text, so that "Șterge filtrele" can empty the box.
    renderFilters(BASE, "dune");

    expect(screen.getByLabelText("Caută în bibliotecă")).toHaveValue("dune");
  });

  it("reports every keystroke — the debounce lives with the page", async () => {
    const { user, onSearchChange } = renderFilters();

    await user.type(screen.getByLabelText("Caută în bibliotecă"), "du");

    expect(onSearchChange).toHaveBeenCalledTimes(2);
  });

  it("offers the reset once a search is the only thing narrowing the list", () => {
    // `isFiltered` counts the search, so the button appears for it too — the
    // gallery would otherwise show "nothing matches" with nothing to undo.
    renderFilters({ ...BASE, q: "dune" });

    expect(
      screen.getByRole("button", { name: "Șterge filtrele" }),
    ).toBeInTheDocument();
  });

  it("clears the search along with the filters", async () => {
    const { user, onChange, onSearchChange } = renderFilters(
      { ...BASE, q: "dune", favorite: true },
      "dune",
    );

    await user.click(screen.getByRole("button", { name: "Șterge filtrele" }));

    // Both halves: the query the API is asked for, and the text on screen.
    expect(asked(onChange).q).toBeUndefined();
    expect(asked(onChange).favorite).toBeUndefined();
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("keeps the search when a filter is toggled", async () => {
    const { user, onChange } = renderFilters({ ...BASE, q: "dune" }, "dune");

    await user.click(screen.getByRole("button", { name: "Citesc" }));

    expect(asked(onChange).q).toBe("dune");
  });
});
