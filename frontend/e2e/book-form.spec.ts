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

  /**
   * The tab strip scrolls sideways when four tabs do not fit, and never
   * downwards. It had a full vertical scrollbar for a while over the 1px the
   * active tab's underline stuck out below the strip — because `overflow-x`
   * alone does not exist (docs/DESIGN.md §Anti-tipare), and because a scrollbar
   * is layout, so nothing in the unit suite could see it.
   */
  test("gives the tab strip no vertical scrollbar to have", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune");

    const strip = page.getByRole("tablist");
    const overflow = await strip.evaluate((el) => el.scrollHeight - el.clientHeight);

    expect(overflow).toBe(0);
  });
});

/**
 * The drawn cover has to hold whatever the title turns out to be.
 *
 * `line-clamp` caps the number of lines and cannot break a word, so a title
 * with no spaces in it ran through the brass rule and out of the placeholder.
 * Layout again: jsdom would report every box as zero.
 */
test.describe("the cover placeholder's lettering", () => {
  test("keeps a title with no spaces in it inside the cover", async ({
    page,
    seed: _seed,
  }) => {
    const unbreakable = "Asdfdasfsaasdfdasfsaasdfdasfsa";

    await page.goto("/");
    await page.getByRole("button", { name: "Adaugă o carte" }).click();
    await page.getByLabel(/^Titlu/).fill(unbreakable);

    // The lettering is `aria-hidden` — the title is a field two rows away — so
    // it is found by its text rather than by a role.
    const lettering = page.getByText(unbreakable, { exact: true });
    await expect(lettering).toBeVisible();

    const spill = await lettering.evaluate((el) => {
      const well = el.closest("label");
      if (well === null) {
        throw new Error("the lettering is no longer inside the cover's label");
      }

      const text = el.getBoundingClientRect();
      const cover = well.getBoundingClientRect();

      return Math.max(text.right - cover.right, cover.left - text.left);
    });

    expect(spill).toBeLessThanOrEqual(0);
  });
});

/**
 * §D49 — the dialog that will not be dismissed by accident.
 *
 * Here rather than in the unit suite for the same reason as the tab heights
 * above: the pulse is a transform, jsdom has no layout, and the half of the
 * behaviour worth guarding is that the dialog ends up **exactly** where it
 * started. A nudge that leaves the panel a fraction larger, or that shifts it
 * a pixel up the screen, is a bug no class-name assertion can see.
 */
test.describe("leaving the book form with unsaved changes (§D49)", () => {
  /** Top-left corner of the viewport: inside the backdrop, well clear of the panel. */
  const clickOutside = (page: Parameters<typeof openEditForm>[0]) =>
    page.mouse.click(5, 5);

  test("closes on a click outside while nothing has been changed", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune");

    // One button, because there is only one thing that can happen.
    await expect(page.getByRole("button", { name: "Salvează" })).toBeHidden();

    await clickOutside(page);

    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("pulses back to exactly its own size instead of closing once a field has changed", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Verdict");
    await page.getByRole("textbox", { name: "Recenzie" }).fill("Prea mult deșert.");

    // The footer has become a decision, and both answers are on screen.
    const dialog = page.getByRole("dialog");
    await expect(page.getByRole("button", { name: "Renunță" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvează" })).toBeVisible();

    const before = await dialog.boundingBox();

    await clickOutside(page);

    await expect(dialog).toBeVisible();
    // Grew, and settled back: the animation is 260ms, so by the time the ring
    // has gone the panel must measure what it measured before the click.
    await expect(dialog).not.toHaveClass(/animate-nudge/);
    expect(await dialog.boundingBox()).toEqual(before);

    // Escape and the ✕ are the same refusal, and the review is still there.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Închide" }).click();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Recenzie" })).toHaveValue(
      "Prea mult deșert.",
    );

    // The way out is the footer, and it still works.
    await page.getByRole("button", { name: "Renunță" }).click();
    await expect(dialog).toBeHidden();
  });
});
