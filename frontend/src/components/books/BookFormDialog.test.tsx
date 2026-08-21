import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { lastWrite, makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

/**
 * What the form *sends*. The shape it is arranged in is `BookFormDialog.tabs`'s
 * subject; this file is about the payload, which is the part that survived the
 * redesign unchanged and must go on doing so.
 *
 * Every field-level assertion here now begins with a tab click, and that is
 * itself worth having in the suite: a value typed on one tab has to still be
 * there after three others have been visited, because only the active panel is
 * mounted (react-hook-form keeps the value of an unmounted field, and this is
 * where we find out if that ever stops being true).
 */
const responder = (call: { url: string }) =>
  call.url.includes("isbn-duplicates") || call.url.includes("/books?")
    ? []
    : makeBook();

function renderForm(book?: Book) {
  const calls = stubApi(responder);
  return { calls, ...renderWithQuery(<BookFormDialog book={book} onClose={vi.fn()} />) };
}

const save = () => screen.getByRole("button", { name: /Salvează|Adaugă/ });

/** The tab, by its name — which also carries the sr-only "has changes" note. */
const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });

/**
 * By role rather than by label: the tab *panel* is named after its tab, so
 * `getByLabelText("Descriere")` matches both the panel and the textarea inside
 * it. Asking for the textbox says which one is meant.
 */
const description = () => screen.getByRole("textbox", { name: "Descriere" });

type User = ReturnType<typeof renderWithQuery>["user"];

const goTo = (user: User, name: string) => user.click(tab(name));

describe("BookFormDialog — pages read (S2.1)", () => {
  it("sends the page the reader has got to", async () => {
    const { calls, user } = renderForm(makeBook({ pagesRead: 143 }));

    await goTo(user, "Lectură");
    const input = screen.getByLabelText("Pagina");
    await user.clear(input);
    await user.type(input, "220");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ pagesRead: 220 }));
  });

  it("shows page zero as an empty box, not as a literal 0", async () => {
    // "Nothing recorded yet" and "I read zero pages" are the same number but
    // not the same statement.
    const { user } = renderForm(makeBook({ pagesRead: 0 }));

    await goTo(user, "Lectură");

    expect(screen.getByLabelText("Pagina")).toHaveValue(null);
  });
});

describe("BookFormDialog — rating (S2.3)", () => {
  it("offers the stars on a finished book", async () => {
    const { user } = renderForm(makeBook({ status: "FINISHED" }));

    await goTo(user, "Verdict");

    expect(screen.getByRole("radio", { name: "4 stele" })).toBeEnabled();
  });

  it("offers them on an abandoned one too (§D11)", async () => {
    const { user } = renderForm(makeBook({ status: "ABANDONED" }));

    await goTo(user, "Verdict");

    expect(screen.getByRole("radio", { name: "4 stele" })).toBeEnabled();
  });

  it("shows them disabled while the book is still being read, not missing", async () => {
    // The design rule: a field that does not apply is disabled, not hidden. A
    // control you can see and cannot use says a rule exists; a control that is
    // absent says nothing at all.
    const { user } = renderForm(makeBook({ status: "READING" }));

    await goTo(user, "Verdict");

    expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4 stele" })).toBeDisabled();
  });

  it("unlocks them as soon as the status changes to a finished one", async () => {
    const { user } = renderForm(makeBook({ status: "READING" }));

    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Terminat" }));
    await goTo(user, "Verdict");

    expect(screen.getByRole("radio", { name: "4 stele" })).toBeEnabled();
  });

  it("sends the star that was picked", async () => {
    const { calls, user } = renderForm(makeBook({ status: "FINISHED", rating: null }));

    await goTo(user, "Verdict");
    await user.click(screen.getByRole("radio", { name: "4 stele" }));
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ rating: 4 }));
  });

  it("sends null when a rating is removed", async () => {
    const { calls, user } = renderForm(makeBook({ status: "FINISHED", rating: 5 }));

    await goTo(user, "Verdict");
    await user.click(screen.getByText("fără rating"));
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ rating: null }));
  });

  it("never clears a rating just because the book went back to READING", async () => {
    // The API refuses to discard the stars on a re-read (§D12); the form must
    // not do from the outside what the server declined to do. Now that the
    // stars are merely disabled rather than unmounted, this is the assertion
    // that keeps `ratingFor` honest.
    const { calls, user } = renderForm(makeBook({ status: "FINISHED", rating: 5 }));

    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Citesc" }));
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ status: "READING" }));
    expect(lastWrite(calls)).not.toHaveProperty("rating");
  });
});

describe("BookFormDialog — paid price (S2.4)", () => {
  it("sends the amount as a number", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Plătit"), "59.90");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ paidPrice: 59.9 }));
  });

  it("accepts a comma, which is what a Romanian keyboard gives", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Plătit"), "59,90");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ paidPrice: 59.9 }));
  });

  it("refuses a third decimal, as the column does", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Plătit"), "12.345");
    await user.click(save());

    expect(await screen.findByText("Cel mult două zecimale")).toBeInTheDocument();
    // The same rule the API enforces, so nothing was sent to be rejected.
    expect(lastWrite(calls)).toBeUndefined();
  });

  it("clears the price when the box is emptied", async () => {
    const { calls, user } = renderForm(makeBook({ paidPrice: 59.9 }));

    await goTo(user, "Lectură");
    await user.clear(screen.getByLabelText("Plătit"));
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ paidPrice: null }));
  });
});

describe("BookFormDialog — estimated price (S3.2)", () => {
  it("sends the estimate as a number", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Estimat"), "59.90");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ estimatedPrice: 59.9 }));
  });

  it("accepts a comma here too", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Estimat"), "59,90");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ estimatedPrice: 59.9 }));
  });

  it("keeps it apart from what was paid (§D6)", async () => {
    // Two boxes, two columns, one request. Only the second feeds the Sprint 6
    // budget, which is the whole reason they are not one field.
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Estimat"), "59.90");
    await user.type(screen.getByLabelText("Plătit"), "45");
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({ estimatedPrice: 59.9, paidPrice: 45 }),
    );
  });

  it("refuses a third decimal, as the column does", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Estimat"), "12.345");
    await user.click(save());

    expect(await screen.findByText("Cel mult două zecimale")).toBeInTheDocument();
    expect(lastWrite(calls)).toBeUndefined();
  });

  it("clears the estimate when the box is emptied", async () => {
    const { calls, user } = renderForm(makeBook({ estimatedPrice: 59.9 }));

    await goTo(user, "Lectură");
    await user.clear(screen.getByLabelText("Estimat"));
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ estimatedPrice: null }));
  });

  it("stays editable on a book that is no longer a wish", async () => {
    // Not tied to WISHLIST: after the purchase the estimate is what the paid
    // price gets compared against. It is the one money field with no lock.
    const { calls, user } = renderForm(
      makeBook({ status: "FINISHED", estimatedPrice: null }),
    );

    await goTo(user, "Lectură");
    await user.type(screen.getByLabelText("Estimat"), "59.90");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ estimatedPrice: 59.9 }));
  });
});

describe("BookFormDialog — creating with Sprint 2 fields", () => {
  it("takes a shelf entry complete with stars and price in one go", async () => {
    const { calls, user } = renderForm();

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Terminat" }));
    await user.type(screen.getByLabelText("Pagina"), "620");
    await user.type(screen.getByLabelText("Plătit"), "59.90");
    await goTo(user, "Verdict");
    await user.click(screen.getByRole("radio", { name: "5 stele" }));
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({
        title: "Dune",
        status: "FINISHED",
        pagesRead: 620,
        paidPrice: 59.9,
        rating: 5,
      }),
    );
  });

  it("still needs nothing but a title (S1.1)", async () => {
    const { calls, user } = renderForm();

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await user.click(save());

    // The two companions are the API's own defaults said out loud, not data the
    // user was made to supply: a new book is a wish, and it is on page zero.
    // What must *not* be there is a rating or a price nobody entered — an empty
    // box is an empty column, never a 0 lei purchase.
    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({
        title: "Dune",
        status: "WISHLIST",
        pagesRead: 0,
      }),
    );
  });
});

/**
 * §D40 — the description is the one prose field on the form that is *about* the
 * book, and the one an assistant is expected to have written before the user
 * ever opens this dialog. So what matters here is that editing does not disturb
 * it: a form that sent the field on every save would overwrite a synopsis
 * whenever someone came in to fix the page count.
 */
describe("BookFormDialog — description (§D40)", () => {
  it("sends what was typed", async () => {
    const { calls, user } = renderForm(makeBook());

    await goTo(user, "Descriere");
    await user.type(description(), "Despre Arrakis.");
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({ description: "Despre Arrakis." }),
    );
  });

  it("shows the one already on the book", async () => {
    const { user } = renderForm(makeBook({ description: "Scrisă de Claude." }));

    await goTo(user, "Descriere");

    expect(description()).toHaveValue("Scrisă de Claude.");
  });

  it("leaves an untouched description out of the payload entirely", async () => {
    const { calls, user } = renderForm(makeBook({ description: "Scrisă de Claude." }));

    await goTo(user, "Lectură");
    const pages = screen.getByLabelText("Pagina");
    await user.clear(pages);
    await user.type(pages, "300");
    await user.click(save());

    // Not `description: "Scrisă de Claude."` sent back unchanged, and above all
    // not `null`: only what the user actually edited travels (`onlyDirty`) —
    // including across a tab the request never visited.
    await waitFor(() => expect(lastWrite(calls)).toEqual({ pagesRead: 300 }));
  });

  it("clears it when the textarea is emptied", async () => {
    const { calls, user } = renderForm(makeBook({ description: "Scrisă de Claude." }));

    await goTo(user, "Descriere");
    await user.clear(description());
    await user.click(save());

    // `null`, not `""` — and the form owns no rule of its own that says so:
    // the payload is piped through `createBookSchema`, the same `nullableText`
    // the API validates with, so an emptied box becomes a cleared column on
    // both sides by construction.
    await waitFor(() => expect(lastWrite(calls)).toEqual({ description: null }));
  });
});
