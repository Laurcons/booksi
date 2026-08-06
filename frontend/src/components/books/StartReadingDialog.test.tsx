import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lastWrite, makeBook, renderWithQuery, stubApi } from "../../test/helpers";
import { StartReadingDialog } from "./StartReadingDialog";

const book = makeBook({ status: "PURCHASED", totalPages: null });

describe("StartReadingDialog (S2.2)", () => {
  it("starts the book with the page count it was given", async () => {
    const calls = stubApi();
    const onClose = vi.fn();
    const { user } = renderWithQuery(
      <StartReadingDialog book={book} onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Nr. de pagini"), "412");
    await user.click(screen.getByRole("button", { name: /Salvează/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastWrite(calls)).toEqual({ status: "READING", totalPages: 412 });
  });

  it("still starts the book when the question is skipped", async () => {
    // Skipping is an answer, not a cancel: S2.2 allows the page count to be
    // refused, never the transition it was asked during.
    const calls = stubApi();
    const onClose = vi.fn();
    const { user } = renderWithQuery(
      <StartReadingDialog book={book} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: "Sari peste" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastWrite(calls)).toEqual({ status: "READING" });
  });

  it("sends no page count when the box is left empty", async () => {
    const calls = stubApi();
    const { user } = renderWithQuery(
      <StartReadingDialog book={book} onClose={vi.fn()} />,
    );

    // Saving is not offered with nothing to save; skipping is the way out.
    expect(screen.getByRole("button", { name: /Salvează/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Sari peste" }));

    expect(lastWrite(calls)).not.toHaveProperty("totalPages");
  });

  it("refuses a page count that is not a whole positive number", async () => {
    const { user } = renderWithQuery(
      <StartReadingDialog book={book} onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Nr. de pagini"), "0");

    expect(screen.getByRole("button", { name: /Salvează/ })).toBeDisabled();
  });

  it("explains what is lost by skipping", async () => {
    // §D4: without the count the reader gets "pag. 143" for the whole book, and
    // they should know that before choosing.
    renderWithQuery(<StartReadingDialog book={book} onClose={vi.fn()} />);

    expect(screen.getByText(/fără procent/)).toBeInTheDocument();
  });
});
