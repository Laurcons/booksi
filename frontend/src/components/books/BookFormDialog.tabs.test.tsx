import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { lastWrite, makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

/**
 * The redesign itself: four tabs, one Save, and the three rules that make a
 * tabbed form survivable.
 *
 * Each `describe` below is one of the ways a tabbed form goes wrong if nobody
 * tests it — a value lost when its panel unmounts, an error hidden on a tab you
 * are not looking at, a locked field that turns out to be merely absent.
 */
const responder = (call: { url: string }) =>
  call.url.includes("isbn-duplicates") || call.url.includes("/books?")
    ? []
    : makeBook();

function renderForm(book?: Book) {
  const calls = stubApi(responder);
  const onClose = vi.fn();
  return {
    calls,
    onClose,
    ...renderWithQuery(<BookFormDialog book={book} onClose={onClose} />),
  };
}

const save = () => screen.getByRole("button", { name: /Salvează|Adaugă/ });
const tab = (name: string) => screen.getByRole("tab", { name: new RegExp(`^${name}`) });
const review = () => screen.getByRole("textbox", { name: "Recenzie" });

type User = ReturnType<typeof renderWithQuery>["user"];

const goTo = (user: User, name: string) => user.click(tab(name));

describe("BookFormDialog — the four tabs", () => {
  it("opens on the book's own details", () => {
    renderForm(makeBook());

    expect(tab("Carte")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Titlu")).toBeInTheDocument();
  });

  it("shows one panel at a time", async () => {
    const { user } = renderForm(makeBook());

    await goTo(user, "Lectură");

    expect(tab("Lectură")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Pagina")).toBeInTheDocument();
    expect(screen.queryByLabelText("Titlu")).not.toBeInTheDocument();
  });

  it("walks between tabs with the arrow keys, as a tablist should", async () => {
    const { user } = renderForm(makeBook());

    tab("Carte").focus();
    await user.keyboard("{ArrowRight}");

    expect(tab("Descriere")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");

    // Wrapped round the end rather than stopping dead at the first tab.
    expect(tab("Verdict")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps what was typed on a panel that has since unmounted", async () => {
    // The whole bet of rendering one panel at a time: react-hook-form holds the
    // value of a field that is no longer in the document. If that ever stops
    // being true, three tabs' worth of edits vanish on the way to Save.
    const { calls, user } = renderForm(makeBook());

    await user.type(screen.getByLabelText("Titlu"), " (ediția a doua)");
    await goTo(user, "Descriere");
    await user.type(screen.getByRole("textbox", { name: "Descriere" }), "Despre Arrakis.");
    await goTo(user, "Verdict");
    await user.type(review(), "Prea lungă.");
    await goTo(user, "Carte");

    expect(screen.getByLabelText("Titlu")).toHaveValue("Dune (ediția a doua)");

    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({
        title: "Dune (ediția a doua)",
        description: "Despre Arrakis.",
        review: "Prea lungă.",
      }),
    );
  });

  it("marks the tab an unsaved change is on", async () => {
    const { user } = renderForm(makeBook());

    await goTo(user, "Verdict");
    await user.type(review(), "x");

    // The dot is drawn, and it is also said out loud: a mark nobody can hear is
    // half a signal.
    expect(tab("Verdict")).toHaveAccessibleName(/are modificări nesalvate/);
    expect(tab("Carte")).not.toHaveAccessibleName(/are modificări nesalvate/);
  });
});

describe("BookFormDialog — an error on a tab you cannot see", () => {
  it("switches to the offending tab instead of failing silently", async () => {
    // `shouldFocusError` cannot focus an unmounted input, so without the invalid
    // branch in `handleSubmit` this is a Save button that visibly does nothing.
    const { calls, user } = renderForm(makeBook());

    await user.clear(screen.getByLabelText("Titlu"));
    await goTo(user, "Verdict");
    await user.click(save());

    await waitFor(() =>
      expect(tab("Carte")).toHaveAttribute("aria-selected", "true"),
    );
    expect(screen.getByText("Titlul e obligatoriu")).toBeInTheDocument();
    expect(lastWrite(calls)).toBeUndefined();
  });

  it("marks the tab as needing a fix rather than as merely changed", async () => {
    const { user } = renderForm(makeBook());

    await user.clear(screen.getByLabelText("Titlu"));
    await user.click(save());

    await waitFor(() =>
      expect(tab("Carte")).toHaveAccessibleName(/are un câmp de corectat/),
    );
  });
});

describe("BookFormDialog — locked fields stay in place (disabled, not hidden)", () => {
  it("shows a wishlist book's progress and dates, closed", async () => {
    const { user } = renderForm(makeBook({ status: "WISHLIST" }));

    await goTo(user, "Lectură");

    expect(screen.getByLabelText("Pagina")).toBeDisabled();
    expect(screen.getByLabelText("Începută")).toBeDisabled();
    expect(screen.getByLabelText("Terminată")).toBeDisabled();
    expect(screen.getByLabelText("Plătit")).toBeDisabled();

    // The two that are never locked: a book can be bought on any day, and the
    // estimate outlives the purchase (§D6).
    expect(screen.getByLabelText("Cumpărată")).toBeEnabled();
    expect(screen.getByLabelText("Estimat")).toBeEnabled();
  });

  it("explains the lock on hover rather than in a line of text", async () => {
    const { user } = renderForm(makeBook({ status: "WISHLIST" }));

    await goTo(user, "Lectură");

    expect(screen.getByLabelText("Pagina")).toHaveAttribute(
      "title",
      "Se deschide când cartea e la tine",
    );
    // And nothing says it on screen.
    expect(screen.queryByText(/Se deschide când cartea e la tine/)).not.toBeInTheDocument();
  });

  it("opens them as soon as the status moves", async () => {
    const { user } = renderForm(makeBook({ status: "WISHLIST" }));

    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Cumpărat" }));

    expect(screen.getByLabelText("Pagina")).toBeEnabled();
    expect(screen.getByLabelText("Plătit")).toBeEnabled();
    // Still nothing to finish: the book has not been opened yet.
    expect(screen.getByLabelText("Terminată")).toBeDisabled();
  });

  it("keeps a stored value while its field is closed, and never sends it", async () => {
    // Flipping a finished book back to the wishlist greys the page count out.
    // It must not empty it, and it must not send a change nobody made.
    const { calls, user } = renderForm(
      makeBook({ status: "FINISHED", pagesRead: 620, rating: 5 }),
    );

    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Wishlist" }));

    const pages = screen.getByLabelText("Pagina");
    expect(pages).toBeDisabled();
    expect(pages).toHaveValue(620);

    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ status: "WISHLIST" }));
  });

  it("offers the shortcut out of a locked verdict", async () => {
    const { calls, user } = renderForm(makeBook({ status: "READING" }));

    await goTo(user, "Verdict");
    await user.click(screen.getByRole("button", { name: "Am terminat-o" }));

    // It moves the status field and nothing else — the save is still the one
    // button at the bottom.
    expect(screen.getByRole("radio", { name: "4 stele" })).toBeEnabled();
    expect(lastWrite(calls)).toBeUndefined();

    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ status: "FINISHED" }));
  });
});

/**
 * The field this redesign added. It is prose like the description, and it is
 * *not* gated like the rating — the two facts that decide everything about how
 * it behaves.
 */
describe("BookFormDialog — the review", () => {
  it("shows the one already on the book", async () => {
    const { user } = renderForm(makeBook({ review: "A doua citire, altă carte." }));

    await goTo(user, "Verdict");

    expect(review()).toHaveValue("A doua citire, altă carte.");
  });

  it("sends what was written", async () => {
    const { calls, user } = renderForm(makeBook({ status: "FINISHED" }));

    await goTo(user, "Verdict");
    await user.type(review(), "Mi-a rămas Maria.");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ review: "Mi-a rămas Maria." }));
  });

  it("is writable while the book is still being read, unlike the stars", async () => {
    // Half of what is worth writing gets written before the last page, and a
    // book abandoned at page forty has a review to write and no stars to give.
    const { calls, user } = renderForm(makeBook({ status: "READING" }));

    await goTo(user, "Verdict");

    expect(review()).toBeEnabled();
    expect(screen.getByRole("radio", { name: "4 stele" })).toBeDisabled();

    await user.type(review(), "Merge greu la început.");
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toEqual({ review: "Merge greu la început." }),
    );
  });

  it("clears the column when the box is emptied", async () => {
    const { calls, user } = renderForm(makeBook({ review: "Ceva." }));

    await goTo(user, "Verdict");
    await user.clear(review());
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ review: null }));
  });

  it("leaves an untouched review out of the payload", async () => {
    const { calls, user } = renderForm(makeBook({ review: "Scrisă cândva." }));

    await user.type(screen.getByLabelText("Titlu"), "!");
    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toEqual({ title: "Dune!" }));
  });

  it("counts the characters against the cap the API enforces", async () => {
    const { user } = renderForm(makeBook({ review: "cinci" }));

    await goTo(user, "Verdict");

    expect(screen.getByText("5 / 10.000")).toBeInTheDocument();
  });
});

describe("BookFormDialog — the header", () => {
  it("keeps the saved title while a new one is being typed", async () => {
    // A header that mirrors the field two rows below it says the same string
    // twice and goes blank at the exact moment the old title is most useful.
    const { user } = renderForm(makeBook({ title: "Dune" }));

    const title = screen.getByLabelText("Titlu");
    await user.clear(title);
    await user.type(title, "Dune. Mesia");

    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
  });

  it("follows the status pills, because a selection is not typing", async () => {
    const { user } = renderForm(makeBook({ status: "READING" }));

    await goTo(user, "Lectură");
    await user.click(screen.getByRole("radio", { name: "Terminat" }));

    // Two "Terminat"s on screen now — the pill in the header and the chosen
    // radio — which is the confirmation this is here to check.
    expect(screen.getAllByText("Terminat")).toHaveLength(2);
  });
});
