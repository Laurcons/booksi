import { openEditForm, test, expect } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * §D51 — the author as an entity, against the real stack.
 *
 * These are the claims the unit suite cannot make, for the reason
 * `book-form.spec.ts` gives about itself: each one is only true if the column,
 * the schema, the service, the payload and the form all agree, which is five
 * files and two processes.
 *
 * The two that matter most are here because they are the whole point of the
 * feature and are invisible in jsdom:
 *
 * - **A biography written from one book reaches the others.** Nothing about a
 *   shared row is observable from inside one form; it takes a second book by
 *   the same author and a round trip.
 * - **The author survived becoming a relation.** Sorting by it, searching for
 *   it and folding its diacritics all moved from a column to a join, and all
 *   three are SQL the client cannot see.
 */

/**
 * The picker's input, by role rather than by label.
 *
 * `getByLabel("Autor")` matches two things and both are correct markup: this
 * input, and the tab *panel*, which is `aria-labelledby` a tab of the same
 * name. Asking for the textbox is the query that means what these tests mean.
 */
const authorBox = (page: Page) => page.getByRole("textbox", { name: "Autor" });

/** The `✕` on one dropdown row — it names the author it is about. */
const deleteRow = (page: Page, name: string) =>
  page.getByRole("button", { name: `Șterge autorul ${name}` });

test.describe("the author entity (§D51)", () => {
  test("writes a biography from one book and shows it on another", async ({
    page,
    seed: _seed,
  }) => {
    // A second book by Cărtărescu, so "shared" is observable at all.
    await page.goto("/");
    await page.getByRole("button", { name: "Adaugă o carte" }).click();
    await page.getByLabel(/Titlu/).fill("Solenoid");
    await page.getByRole("tab", { name: /^Autor/ }).click();
    await authorBox(page).fill("Cărtă");
    await page.getByRole("button", { name: /^Mircea Cărtărescu/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Adaugă", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Write the biography from *Orbitor*'s form.
    await openEditForm(page, "Orbitor", "Autor");

    // The subtle indication, with the count that makes it concrete rather than
    // a disclaimer.
    await expect(page.getByText(/Se aplică tuturor celor 2 cărți/)).toBeVisible();

    await page
      .getByLabel("Biografie")
      .fill("Autorul trilogiei Orbitor, scrisă între 1996 și 2007.");
    await page.getByRole("button", { name: "Salvează" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // And it is on the *other* book's page, which never knew about the edit.
    await page.goto("/");
    await page.getByRole("button", { name: "Solenoid" }).click();
    await expect(page.getByText("Despre Mircea Cărtărescu")).toBeVisible();
    await expect(
      page.getByText("Autorul trilogiei Orbitor, scrisă între 1996 și 2007."),
    ).toBeVisible();
  });

  /**
   * The rule the picker exists for. §D49 gives it a sharper edge than expected:
   * a name nobody confirmed leaves the form **clean**, so there is no Save to
   * press — text in the box is a query, not a value.
   */
  test("does not create an author from typed text alone", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Autor");

    await authorBox(page).fill("Frnak Herbet");
    await expect(
      page.getByRole("button", { name: /Creează autorul „Frnak Herbet”/ }),
    ).toBeVisible();

    // Nothing to save, because nothing changed.
    await expect(page.getByRole("button", { name: "Salvează" })).toHaveCount(0);

    // Leaving the field discards it rather than keeping a name that is not an
    // author. Switching tabs is what takes the focus away.
    await page.getByRole("tab", { name: /^Carte/ }).click();
    await page.getByRole("tab", { name: /^Autor/ }).click();
    await expect(authorBox(page)).toHaveValue("Frank Herbert");

    // And the dropdown never learned the misspelling.
    await authorBox(page).click();
    await expect(page.getByRole("button", { name: /^Frnak Herbet/ })).toHaveCount(0);
  });

  test("creates an author on a deliberate click and attaches it", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Autor");

    await authorBox(page).fill("Brian Herbert");
    await page.getByRole("button", { name: /Creează autorul „Brian Herbert”/ }).click();

    // The toast — this app's first, and §D51's reason for having any.
    await expect(page.getByText(/Autorul „Brian Herbert” a fost creat/)).toBeVisible();
    await expect(authorBox(page)).toHaveValue("Brian Herbert");

    await page.getByRole("button", { name: "Salvează" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Saving leaves the reader on the book's page, so the name is already in
    // front of them — under the title, where the author goes.
    //
    // Located as the `<h1>`'s own next sibling rather than by text: the name is
    // legitimately on screen three times (here, on the cover placeholder, and
    // in the toast), and this is the one place that means "this book's author".
    await expect(page.locator("h1 + p")).toHaveText("Brian Herbert");
  });

  /**
   * §D51 — an author no book points at goes without a confirmation, because
   * there is nothing to warn about. That is also the escape hatch for the
   * orphan a cancelled form leaves behind, which is what makes immediate
   * creation acceptable at all.
   */
  test("deletes an unused author without asking, and asks about a used one", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Autor");

    // Make an author nothing uses…
    await authorBox(page).fill("Nimeni Nimeni");
    await page.getByRole("button", { name: /Creează autorul/ }).click();
    await expect(authorBox(page)).toHaveValue("Nimeni Nimeni");

    // …point the book back at Herbert, leaving the new one unused…
    await authorBox(page).fill("Herbert");
    await page.getByRole("button", { name: /^Frank Herbert/ }).click();

    // …and remove it from the same dropdown that made it, in one click.
    await authorBox(page).click();
    await deleteRow(page, "Nimeni Nimeni").click();
    await expect(page.getByText(/„Nimeni Nimeni” a fost șters/)).toBeVisible();

    // One that books point at asks first, and says how many.
    await authorBox(page).click();
    await deleteRow(page, "Frank Herbert").click();
    await expect(
      page.getByText(/Ștergi „Frank Herbert”\? O carte rămâne fără autor/),
    ).toBeVisible();
  });

  /**
   * The relation, exercised as SQL: sorting, searching, and the collation's
   * diacritic folding through the join. None of it is visible from the client,
   * and all of it used to read a column on `Book`.
   */
  test("sorts and searches by the author through the relation", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");

    const firstAuthor = page.locator("table tbody tr td:nth-child(3)").first();

    await page.getByRole("button", { name: /^Autor/ }).click();
    await expect(firstAuthor).toHaveText("Douglas Hofstadter");

    await page.getByRole("button", { name: /^Autor/ }).click();
    await expect(firstAuthor).toHaveText("Varujan Vosganian");

    // §D42 — free text still finds a book by its author, and the database's
    // collation still folds the diacritics on the way there.
    const search = page.getByPlaceholder(/Caută/).first();

    await search.fill("herbert");
    await expect(page.getByRole("button", { name: "Dune" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Orbitor" })).toHaveCount(0);

    await search.fill("cartarescu");
    await expect(page.getByRole("button", { name: "Orbitor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dune" })).toHaveCount(0);
  });

  /**
   * §D51 — deleting an author leaves its books standing, without one
   * (`onDelete: SetNull`). Cascade would have deleted the books, which is
   * catastrophic for a housekeeping click in a dropdown, so this is the
   * assertion that would catch it.
   */
  test("leaves the books standing when their author is deleted", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune", "Autor");

    await authorBox(page).click();
    await deleteRow(page, "Frank Herbert").click();
    // Scoped to the row that is asking: the page behind the dialog has a
    // "Șterge" of its own, for the book.
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ștergi „Frank Herbert”" })
      .getByRole("button", { name: "Șterge", exact: true })
      .click();

    await expect(page.getByText(/„Frank Herbert” a fost șters/)).toBeVisible();
    // The field emptied with it: the column is already NULL, server-side.
    await expect(authorBox(page)).toHaveValue("");

    await page.goto("/");

    // The book is still there, and has no author.
    await expect(page.getByRole("button", { name: "Dune" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Frank Herbert" })).toHaveCount(0);
  });
});
