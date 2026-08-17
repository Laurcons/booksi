import { expect, openEditForm, test } from "./fixtures.js";

/**
 * Sprint 3, through a browser and against the real stack: MariaDB, the Nest
 * API, the Vite app. Nothing is mocked — the unit suites already cover what a
 * component sends, and repeating that here would be slower and no truer.
 *
 * What only this level can catch is everything between the pieces: the SQL sum
 * behind S3.3 (`aggregate` is mocked in the backend suite, so this is the first
 * time it meets MariaDB), the status filter surviving a real query string, the
 * cookie riding cross-origin to :3000, and whether a purchase actually moves a
 * book from one screen to the other.
 *
 * Requires the stack to be up — see `npm run test:e2e`.
 */

const total = () => "main p.tabular";

test.describe("the wishlist view (S3.1)", () => {
  test("shows only wishlist books, where the library shows all of them", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await expect(page.locator("tbody tr")).toHaveCount(7);

    await page.getByRole("link", { name: "Wishlist" }).click();
    await page.waitForURL("**/wishlist");

    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expect(page.getByRole("cell", { name: "Dune" })).toHaveCount(0);
  });

  test("swaps the money column for the estimate", async ({ page, seed: _seed }) => {
    // A wishlist book has not been paid for, so the library's column would be
    // a row of dashes. Same table, different question (§D6).
    await page.goto("/");
    await expect(page.locator("thead th").nth(5)).toHaveAccessibleName("Preț");

    await page.goto("/wishlist");
    await expect(page.locator("thead th").nth(5)).toHaveAccessibleName(
      "Preț estimat",
    );
    await expect(
      page.locator("tbody tr", { hasText: "Solaris" }).locator("td").nth(5),
    ).toHaveText("42.00");
  });

  test("marks itself as the current page in the nav", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");

    await expect(page.getByRole("link", { name: "Wishlist" })).toHaveClass(
      /text-ink(?!-)/,
    );
  });
});

test.describe("the total (S3.3)", () => {
  test("sums the priced books and says how many that is", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");

    // 42.00 + 89.50 + 208.50, over three of the five books on the page. The
    // two non-wishlist books carry prices too and must not be in it.
    await expect(page.locator(total())).toHaveText(/340\.00\s*lei/);
    await expect(
      page.getByText("3 din 5 cărți au preț estimat."),
    ).toBeVisible();
  });

  test("follows an edited price", async ({ page, seed: _seed }) => {
    await page.goto("/wishlist");
    await openEditForm(page, "Orbitor");

    const estimate = page.getByLabel(/Cât cred că va costa/);
    await expect(estimate).toHaveValue("89.50");

    // A comma, which is what a Romanian keyboard produces for a decimal.
    await estimate.fill("95,50");
    await page.getByRole("button", { name: "Salvează" }).click();

    // Saving leaves the user on the book's page, not on the wishlist (§D41) —
    // so the way back is the back button, and following it is worth doing
    // rather than a `goto`: the total has to be right on the screen the user
    // actually lands on, refetched rather than served stale from the cache the
    // edit just invalidated.
    await page.getByRole("link", { name: /Înapoi la wishlist/ }).click();

    await expect(page.locator(total())).toHaveText(/346\.00\s*lei/);
  });

  test("stays off an empty wishlist", async ({ page, seed: _seed }) => {
    await page.goto("/wishlist");

    for (const title of [
      "Solaris",
      "Orbitor",
      "Gödel, Escher, Bach",
      "Cartea șoaptelor",
      "Maitreyi",
    ]) {
      await page
        .locator("tbody tr", { hasText: title })
        .getByRole("button", { name: "Am cumpărat-o" })
        .click();
      await expect(page.getByRole("cell", { name: title })).toHaveCount(0);
    }

    await expect(page.getByText("Wishlist-ul e gol")).toBeVisible();
    // "0.00 lei" over an empty list would read as a total, not as an absence.
    await expect(page.locator(total())).toHaveCount(0);
  });
});

test.describe("buying a book (S3.4)", () => {
  test("takes one click and no modal", async ({ page, seed: _seed }) => {
    await page.goto("/wishlist");

    await page
      .locator("tbody tr", { hasText: "Solaris" })
      .getByRole("button", { name: "Am cumpărat-o" })
      .click();

    await expect(page.locator("[role=dialog]")).toHaveCount(0);
    await expect(page.locator("tbody tr")).toHaveCount(4);
    // 340.00 less the 42.00 the bought book was carrying.
    await expect(page.locator(total())).toHaveText(/298\.00\s*lei/);
    await expect(
      page.getByText("2 din 4 cărți au preț estimat."),
    ).toBeVisible();
  });

  test("carries the estimate into what was paid, and dates it", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");
    await page
      .locator("tbody tr", { hasText: "Solaris" })
      .getByRole("button", { name: "Am cumpărat-o" })
      .click();
    await expect(page.locator("tbody tr")).toHaveCount(4);

    await page.getByRole("link", { name: "Bibliotecă" }).click();
    const row = page.locator("tbody tr", { hasText: "Solaris" });

    await expect(row.locator("td").nth(3)).toHaveText("Cumpărat");
    await expect(row.locator("td").nth(5)).toHaveText("42.00");

    // All three fields stay editable afterwards — the click is a shortcut, not
    // a commitment.
    await openEditForm(page, "Solaris");
    await expect(page.getByLabel(/Cât am plătit/)).toHaveValue("42.00");
    await expect(page.getByLabel("Cumpărată")).not.toHaveValue("");
  });

  test("does not block on a book with no estimate", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");

    await page
      .locator("tbody tr", { hasText: "Maitreyi" })
      .getByRole("button", { name: "Am cumpărat-o" })
      .click();

    // Bought, and the paid price is simply left empty.
    await expect(page.locator("tbody tr")).toHaveCount(4);
    await page.getByRole("link", { name: "Bibliotecă" }).click();
    const row = page.locator("tbody tr", { hasText: "Maitreyi" });
    await expect(row.locator("td").nth(3)).toHaveText("Cumpărat");
    await expect(row.locator("td").nth(5)).toHaveText("—");
  });
});

test.describe("the estimated price (S3.2)", () => {
  test("sits beside the paid price, on any status", async ({
    page,
    seed: _seed,
  }) => {
    // Not tied to WISHLIST: after the purchase the estimate is what the paid
    // price gets compared against.
    await page.goto("/");
    await openEditForm(page, "Dune");

    await expect(page.getByLabel(/Cât cred că va costa/)).toHaveValue("65.00");
    await expect(page.getByLabel(/Cât am plătit/)).toHaveValue("59.90");
  });

  test("is optional — a book sits in the wishlist without one", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/wishlist");

    const row = page.locator("tbody tr", { hasText: "Cartea șoaptelor" });
    // A dash, not a zero: "I haven't decided" is not "free".
    await expect(row.locator("td").nth(5)).toHaveText("—");
  });
});
