import { expect, test } from "./fixtures.js";

/**
 * §D42, through a browser and against the real stack.
 *
 * What only this level can catch: the `LIKE` actually running in MariaDB under
 * the `utf8mb4_unicode_ci` collation — which is where case- and
 * diacritic-insensitivity come from, so no unit test can show it — the term
 * surviving a real query string, and the three searchable fields that appear
 * in no column (publisher, ISBN, description) genuinely being searched.
 *
 * The debounce is 300ms, so every assertion here waits on the *list*, never on
 * a request count. Playwright's auto-waiting covers it; a `waitForTimeout`
 * would be both slower and flakier.
 *
 * Requires the stack to be up — see `npm run test:e2e`.
 */

const box = "Caută în bibliotecă";

test.describe("searching the library (§D42)", () => {
  test("narrows the table to what was typed", async ({ page, seed: _seed }) => {
    await page.goto("/");
    await expect(page.locator("tbody tr")).toHaveCount(7);

    await page.getByLabel(box).fill("dune");

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "Dune" })).toBeVisible();
  });

  test("ignores case and diacritics, because the collation does", async ({
    page,
    seed: _seed,
  }) => {
    // "SOAPTELOR" against "Cartea șoaptelor": neither the case nor the ș is
    // handled anywhere in the code — `utf8mb4_unicode_ci` folds both.
    await page.goto("/");

    await page.getByLabel(box).fill("SOAPTELOR");

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "Cartea șoaptelor" })).toBeVisible();
  });

  test("lets two words match two different fields", async ({ page, seed: _seed }) => {
    // As one substring this matches nothing: no field holds "herbert dune".
    // Split into two terms, the author supplies one and the title the other.
    await page.goto("/");

    await page.getByLabel(box).fill("herbert dune");

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "Dune" })).toBeVisible();
  });

  test("narrows further with every extra word", async ({ page, seed: _seed }) => {
    await page.goto("/");

    await page.getByLabel(box).fill("mircea");
    // Cărtărescu and Eliade.
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await page.getByLabel(box).fill("mircea eliade");
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("finds a book by fields no column shows", async ({ page, seed: _seed }) => {
    // Publisher, ISBN and description are searchable and invisible. Maitreyi is
    // the seed's only row carrying them.
    await page.goto("/");

    for (const term of ["humanitas", "978-973-50", "Calcutta"]) {
      await page.getByLabel(box).fill(term);

      await expect(page.locator("tbody tr")).toHaveCount(1);
      await expect(page.getByRole("cell", { name: "Maitreyi" })).toBeVisible();
    }
  });

  test("survives a re-sort", async ({ page, seed: _seed }) => {
    // The header used to rebuild the query from the sort alone, which dropped
    // the search — the list would have quietly come back to all seven rows
    // under a box that still read "mircea".
    await page.goto("/");
    await page.getByLabel(box).fill("mircea");
    await expect(page.locator("tbody tr")).toHaveCount(2);

    await page.getByRole("button", { name: /Titlu/ }).click();

    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByLabel(box)).toHaveValue("mircea");
    // Sorted, and still only the two.
    await expect(page.locator("tbody tr").first()).toContainText("Maitreyi");
  });

  test("says the search found nothing, not that the library is empty", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");

    await page.getByLabel(box).fill("zzz-nimic");

    await expect(page.getByText("Nicio carte nu se potrivește")).toBeVisible();

    // And the way back is one click, which also empties the box.
    await page.getByRole("button", { name: "Arată toate cărțile" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(7);
    await expect(page.getByLabel(box)).toHaveValue("");
  });
});

test.describe("searching the gallery", () => {
  test("combines the search with the filters, rather than replacing them", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/gallery");
    await expect(page.getByRole("listitem")).toHaveCount(7);

    // Wishlist only: five of the seven.
    await page.getByRole("button", { name: "Wishlist" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(5);

    // Both at once — Dune is a match for the word but is not on the wishlist.
    await page.getByLabel(box).fill("mircea");
    await expect(page.getByRole("listitem")).toHaveCount(2);

    await page.getByLabel(box).fill("dune");
    await expect(page.getByText("Nicio carte nu se potrivește")).toBeVisible();
  });

  test("clears the search along with the filters", async ({ page, seed: _seed }) => {
    await page.goto("/gallery");
    await page.getByRole("button", { name: "Citesc" }).click();
    await page.getByLabel(box).fill("dune");
    await expect(page.getByRole("listitem")).toHaveCount(1);

    await page.getByRole("button", { name: "Șterge filtrele" }).click();

    await expect(page.getByRole("listitem")).toHaveCount(7);
    await expect(page.getByLabel(box)).toHaveValue("");
  });
});

test.describe("searching the wishlist", () => {
  test("narrows the list but not the total", async ({ page, seed: _seed }) => {
    // The decision this test exists for: the total stays global (S3.3), so it
    // has to say so out loud once the list under it stops agreeing.
    await page.goto("/wishlist");
    await expect(page.locator("tbody tr")).toHaveCount(5);
    const total = page.locator("main p.tabular");
    const before = await total.textContent();

    await page.getByLabel("Caută în bibliotecă").fill("maitreyi");

    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(total).toHaveText(before ?? "");
    await expect(
      page.getByText("Totalul e pentru tot wishlist-ul", { exact: false }),
    ).toBeVisible();
  });

  test("never reaches outside the wishlist", async ({ page, seed: _seed }) => {
    // Dune is in the library and matches the word; the status filter this page
    // *is* must survive the search.
    await page.goto("/wishlist");

    await page.getByLabel("Caută în bibliotecă").fill("dune");

    await expect(page.getByText("Nicio carte nu se potrivește")).toBeVisible();
  });
});
