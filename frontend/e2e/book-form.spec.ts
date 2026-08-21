import { openEditForm, test, expect } from "./fixtures.js";

/**
 * §D48 — the tabbed edit dialog, in a real browser.
 *
 * These four are here because none of them can be checked anywhere else. jsdom
 * has no layout, so the constant-height rule is unassertable in the unit suite;
 * and the review's round trip is only true if the column, the schema, the
 * payload builder and the form agree, which is four files and two processes.
 */
test.describe("the book form's tabs (§D48)", () => {
  test("does not change size when you switch tabs", async ({ page, seed: _seed }) => {
    // The failure this catches is subtle and was real: `flex-1` on the panel
    // body zeroes its flex basis, the declared height stops applying, and the
    // dialog resizes under the pointer on every tab click.
    await page.goto("/");
    await openEditForm(page, "Dune");

    const dialog = page.getByRole("dialog");
    const first = await dialog.boundingBox();

    for (const tab of ["Descriere", "Lectură", "Verdict"] as const) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      const box = await dialog.boundingBox();
      expect(box?.height, `height on ${tab}`).toBe(first?.height);
      expect(box?.y, `top edge on ${tab}`).toBe(first?.y);
    }
  });

  test("carries an edit made on one tab through a save made from another", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Verdict");
    await page.getByRole("textbox", { name: "Recenzie" }).fill("Prea mult deșert.");

    await page.getByRole("tab", { name: /^Lectură/ }).click();
    await page.getByLabel("Pagina").fill("311");

    // Saved from a third tab, with changes on two others — and the strip says
    // where they are while they are out of sight.
    await page.getByRole("tab", { name: /^Descriere/ }).click();
    await expect(page.getByRole("tab", { name: /^Verdict/ })).toHaveAccessibleName(
      /are modificări nesalvate/,
    );
    await page.getByRole("button", { name: "Salvează" }).click();

    // All the way to MariaDB and back: the page behind re-reads the book.
    await expect(page.getByText("311 din 620")).toBeVisible();

    // Saving leaves the user on the book's own page (§D41), so the way back in
    // is the button on it — not the table row the helper looks for.
    await page.getByRole("button", { name: "Editează" }).click();
    await page.getByRole("tab", { name: /^Verdict/ }).click();
    await expect(page.getByRole("textbox", { name: "Recenzie" })).toHaveValue(
      "Prea mult deșert.",
    );
  });

  test("keeps a wishlist book's progress and dates closed, and its estimate open", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");
    await openEditForm(page, "Solaris", "Lectură");

    await expect(page.getByLabel("Pagina")).toBeDisabled();
    await expect(page.getByLabel("Începută")).toBeDisabled();
    await expect(page.getByLabel("Plătit")).toBeDisabled();
    await expect(page.getByLabel("Estimat")).toBeEnabled();
    await expect(page.getByLabel("Cumpărată")).toBeEnabled();

    // Not hidden — present, and explaining itself on hover.
    await expect(page.getByLabel("Pagina")).toHaveAttribute(
      "title",
      "Se deschide când cartea e la tine",
    );
  });

  test("goes to the tab holding the problem when a save is refused", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune");
    await page.getByLabel(/^Titlu/).fill("");

    await page.getByRole("tab", { name: /^Verdict/ }).click();
    await page.getByRole("button", { name: "Salvează" }).click();

    await expect(page.getByRole("tab", { name: /^Carte/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Titlul e obligatoriu")).toBeVisible();
    // Still open, nothing sent: the book keeps its title.
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
