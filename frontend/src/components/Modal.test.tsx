import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

/**
 * A dialog that says `aria-modal="true"` is promising that nothing behind it
 * can be reached. Escape and the backdrop click were already honoured; the
 * keyboard was not, and Tab walked straight out into the page the dialog claims
 * to have covered — where a screen reader reads content that is supposed to be
 * inert and a sighted keyboard user loses track of where they are.
 */
function Fixture({ onClose = () => {} }: { onClose?: () => void }) {
  return (
    <>
      <button type="button">behind the dialog</button>
      <Modal title="Ștergi cartea?" onClose={onClose}>
        <input aria-label="first" />
        <button type="button">middle</button>
        <button type="button">last</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("puts focus on the first control when it opens", () => {
    render(<Fixture />);

    expect(screen.getByLabelText("first")).toHaveFocus();
  });

  it("wraps Tab from the last control back to the first", async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText("first")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control round to the last", async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });

  it("never lets focus reach the page behind it", async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    const behind = screen.getByRole("button", { name: "behind the dialog" });

    for (let press = 0; press < 6; press += 1) {
      await user.tab();
      expect(behind).not.toHaveFocus();
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
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

    render(<Host />);

    const opener = screen.getByRole("button", { name: "Editează" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
