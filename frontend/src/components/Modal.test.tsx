import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";
import { renderWithQuery } from "../test/helpers";

/**
 * Rendered through `renderWithQuery` rather than bare `render`: the dialog
 * words its own close button now, so it reads the catalog like any other
 * component. Those are the same providers every screen in the app runs inside.
 */

/**
 * A dialog that says `aria-modal="true"` is promising that nothing behind it
 * can be reached. Escape and the backdrop click were already honoured; the
 * keyboard was not, and Tab walked straight out into the page the dialog claims
 * to have covered — where a screen reader reads content that is supposed to be
 * inert and a sighted keyboard user loses track of where they are.
 */
function Fixture({
  onClose = () => {},
  unsaved = false,
  dismissible = false,
}: {
  onClose?: () => void;
  unsaved?: boolean;
  /** Off by default: the ✕ is a fourth focusable thing, and the Tab-order
      assertions below count them. */
  dismissible?: boolean;
}) {
  return (
    <>
      <button type="button">behind the dialog</button>
      <Modal
        title="Ștergi cartea?"
        onClose={onClose}
        unsaved={unsaved}
        dismissible={dismissible}
      >
        <input aria-label="first" />
        <button type="button">middle</button>
        <button type="button">last</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("puts focus on the first control when it opens", () => {
    renderWithQuery(<Fixture />);

    expect(screen.getByLabelText("first")).toHaveFocus();
  });

  it("wraps Tab from the last control back to the first", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Fixture />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText("first")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control round to the last", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Fixture />);

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });

  it("never lets focus reach the page behind it", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Fixture />);

    const behind = screen.getByRole("button", { name: "behind the dialog" });

    for (let press = 0; press < 6; press += 1) {
      await user.tab();
      expect(behind).not.toHaveFocus();
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithQuery(<Fixture onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  /**
   * §D49. The two dismissals a `Modal` stops honouring once there is something
   * inside it to lose are exactly the two nobody chose: a key pressed out of
   * habit, and a click that landed wide of the panel. Both now say so rather
   * than throwing the work away, and the saying is tested in all three of the
   * ways it is done — the pulse, the ring that survives reduced motion, and
   * the sentence for anyone who sees neither.
   */
  describe("with unsaved changes inside it", () => {
    const backdrop = () => screen.getByRole("dialog").parentElement as HTMLElement;

    it("pulses instead of closing on Escape", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithQuery(<Fixture onClose={onClose} unsaved />);

      await user.keyboard("{Escape}");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveClass("animate-nudge", "ring-accent/40");
      expect(screen.getByRole("status")).toHaveTextContent("Modificări nesalvate");
    });

    it("pulses instead of closing on a click outside the panel", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithQuery(<Fixture onClose={onClose} unsaved />);

      await user.click(backdrop());

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveClass("animate-nudge");
    });

    it("still closes on a click outside once there is nothing to lose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithQuery(<Fixture onClose={onClose} />);

      await user.click(backdrop());

      expect(onClose).toHaveBeenCalled();
    });

    it("pulses instead of closing when its own ✕ is pressed", async () => {
      // The loophole this closes: the ✕ is the nearest thing to hand after a
      // refused backdrop click, and it is no better able to tell "discard"
      // from "save" than the backdrop was.
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithQuery(<Fixture onClose={onClose} unsaved dismissible />);

      await user.click(screen.getByRole("button", { name: "Închide" }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveClass("animate-nudge");
    });

    it("says why on hover, before the click rather than after it", () => {
      renderWithQuery(<Fixture unsaved dismissible />);

      expect(screen.getByRole("button", { name: "Închide" })).toHaveAttribute(
        "title",
        "Modificări nesalvate — renunți sau salvezi.",
      );
    });

    it("still closes on its ✕ when there is nothing to lose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithQuery(<Fixture onClose={onClose} dismissible />);

      await user.click(screen.getByRole("button", { name: "Închide" }));

      expect(onClose).toHaveBeenCalled();
    });

    it("says nothing until a dismissal is actually refused", () => {
      renderWithQuery(<Fixture unsaved />);

      expect(screen.getByRole("dialog")).not.toHaveClass("animate-nudge");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  /**
   * Without this the keyboard lands back at the top of the document, and a
   * user who opened the dialog from the last row of a long table has to travel
   * the whole way down again.
   */
  it("returns focus to whatever opened it", async () => {
    const user = userEvent.setup();

    function Host() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Editează
          </button>
          {open && (
            <Modal title="Editează cartea" onClose={() => setOpen(false)}>
              <button type="button">Renunță</button>
            </Modal>
          )}
        </>
      );
    }

    renderWithQuery(<Host />);

    const opener = screen.getByRole("button", { name: "Editează" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
