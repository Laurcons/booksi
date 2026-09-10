import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../test/helpers";
import { CategoryPicker } from "./CategoryPicker";

/**
 * §D45 — the picker's two behaviours that are not visible in a screenshot: what
 * happens to the search after a pick, and how the keyboard gets through a list
 * that is now drawn outside the dialog.
 *
 * The placement itself is deliberately not asserted here. jsdom has no layout,
 * so every `getBoundingClientRect` is zeroes and any assertion about where the
 * list *is* would be a test of the stub rather than of the component — that
 * part is verified in a browser.
 */

const box = () => screen.getByPlaceholderText(/Caută categorii/);
const row = (name: string) => screen.getByRole("button", { name });

function setup(value: string[] = []) {
  const onChange = vi.fn();

  return {
    onChange,
    ...renderWithQuery(
      <CategoryPicker
        chipsInside
        value={value}
        ariaLabel="Categorii"
        className=""
        onChange={onChange}
      />,
    ),
  };
}

describe("CategoryPicker", () => {
  /**
   * The reported bug: the text that found a shelf stayed in the box, so the
   * list remained filtered to the one row just chosen and a second selection
   * needed a manual clear first.
   */
  it("clears the search once a category is picked", async () => {
    const { user, onChange } = setup();

    await user.type(box(), "fant");
    await user.click(row("Fantasy"));

    expect(onChange).toHaveBeenCalledWith(["FICTION__FANTASY"]);
    expect(box()).toHaveValue("");
  });

  /**
   * And only from the list. The chips' `✕` calls the same toggle, and wiping a
   * half-typed search because somebody removed an unrelated chip would be a
   * second surprise in place of the first.
   */
  it("keeps the search when a chip is removed", async () => {
    const { user } = setup(["FICTION__SF"]);

    await user.type(box(), "fant");
    await user.click(row("Elimină SF"));

    expect(box()).toHaveValue("fant");
  });

  it("walks the list with the arrows and picks with Enter", async () => {
    const { user, onChange } = setup();

    await user.click(box());
    // Two steps into [Generalități, SF, Fantasy, Istorie generală].
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(["FICTION__SF"]);
  });

  /**
   * The arrows are not a convenience, they are the only way through: the list
   * is portalled out of the dialog and therefore outside `Modal`'s focus trap,
   * where a tabbable row would send the next Tab to the top of the dialog.
   */
  it("leaves the rows out of the tab order", async () => {
    const { user } = setup();

    await user.click(box());

    for (const name of ["Generalități", "SF", "Fantasy", "Istorie generală"]) {
      expect(row(name)).toHaveAttribute("tabindex", "-1");
    }
  });

  it("draws the list outside the field, over the page", async () => {
    const { user, container } = setup();

    await user.click(box());

    expect(container).not.toContainElement(row("Fantasy"));
    expect(document.body).toContainElement(row("Fantasy"));
  });

  it("closes on Escape", async () => {
    const { user } = setup();

    await user.click(box());
    expect(row("Fantasy")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Fantasy" })).not.toBeInTheDocument();
  });
});
