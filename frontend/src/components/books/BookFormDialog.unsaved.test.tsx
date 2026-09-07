import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book } from "@bookcsi/shared";
import { makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

/**
 * §D49 — the footer says what the dialog is currently for, and the dialog
 * stops being dismissible by accident once there is something in it to lose.
 *
 * The refusal itself belongs to `Modal` and is tested there. What is tested
 * here is the question `Modal` is answering — *is* there anything unsaved,
 * which for this form is not merely "did a field change", because a cover
 * picked before the book exists is held in state and is the one change the
 * form itself cannot see — and the fact that adding and editing answer the
 * "what is this dialog for" question differently.
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

/** The ✕ carries the same name as the footer's own button, so both are counted. */
const closeButtons = () => screen.getAllByRole("button", { name: "Închide" });
const cancel = () => screen.queryByRole("button", { name: "Renunță" });
const save = () => screen.queryByRole("button", { name: /Salvează|Adaugă/ });

describe("BookFormDialog — leaving with unsaved changes", () => {
  describe("editing", () => {
    it("offers one way out while nothing has changed", () => {
      renderForm(makeBook());

      // The ✕ and the footer's Închide, and no decision to make.
      expect(closeButtons()).toHaveLength(2);
      expect(cancel()).not.toBeInTheDocument();
      expect(save()).not.toBeInTheDocument();
    });

    it("turns the footer into a decision as soon as a field changes", async () => {
      const { user } = renderForm(makeBook());

      await user.type(screen.getByLabelText("Titlu"), "!");

      expect(cancel()).toBeInTheDocument();
      expect(save()).toBeInTheDocument();
      // Only the ✕ is left holding that name.
      expect(closeButtons()).toHaveLength(1);
    });

    it("goes back to a single Close when the change is undone", async () => {
      const { user } = renderForm(makeBook({ title: "Solaris" }));

      const title = screen.getByLabelText("Titlu");
      await user.type(title, "!");
      await user.type(title, "{Backspace}");

      expect(closeButtons()).toHaveLength(2);
      expect(save()).not.toBeInTheDocument();
    });
  });

  /**
   * A form opened to create a book is never a form someone came to read, so
   * its footer never becomes a single Close — moving the Adaugă onto the
   * screen at the first keystroke would shift the target while it is being
   * aimed at.
   */
  describe("adding", () => {
    it("offers Cancel and Add from the first render", () => {
      renderForm();

      expect(cancel()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adaugă" })).toBeInTheDocument();
      expect(closeButtons()).toHaveLength(1);
    });

    it("keeps the same two buttons once something is typed", async () => {
      const { user } = renderForm();

      await user.type(screen.getByLabelText("Titlu"), "Solaris");

      expect(cancel()).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Adaugă" })).toBeInTheDocument();
    });
  });

  describe("the dismissals it stops honouring", () => {
    it("does not close on Escape once a field has changed", async () => {
      const { onClose, user } = renderForm(makeBook());

      await user.type(screen.getByLabelText("Titlu"), "!");
      await user.keyboard("{Escape}");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveClass("animate-nudge");
    });

    it("still closes on Escape when the form is untouched", async () => {
      const { onClose, user } = renderForm(makeBook());

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalled();
    });

    /**
     * The whole reason `unsaved` is not just "a field changed": S4.3's cover
     * is picked before the book has an id, so it waits in component state
     * while every field on the form is still untouched. Closing here used to
     * drop the file without a word.
     */
    it("counts a cover chosen before the book exists", async () => {
      const { onClose, user } = renderForm();

      const file = new File(["cover"], "cover.png", { type: "image/png" });
      await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);
      await user.keyboard("{Escape}");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveClass("animate-nudge");
    });
  });
});
