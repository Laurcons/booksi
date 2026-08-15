import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lastWrite, makeBook, renderWithQuery, stubApi, type ApiCall } from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

const library = [
  makeBook({ id: "book-1", title: "Dune", author: "Frank Herbert" }),
  makeBook({ id: "book-2", title: "Dune Messiah", author: "Frank Herbert" }),
  makeBook({ id: "book-3", title: "Foundation", author: "Isaac Asimov" }),
  makeBook({ id: "book-4", title: "No author yet", author: null }),
];

const defaults = (call: ApiCall) => {
  if (call.url.includes("isbn-duplicates")) return [];
  if (call.url.includes("/books?")) return library;
  return makeBook();
};

function renderForm(book?: Parameters<typeof BookFormDialog>[0]["book"]) {
  const calls = stubApi(defaults);
  return { calls, ...renderWithQuery(<BookFormDialog book={book} onClose={vi.fn()} />) };
}

const author = () => screen.getByLabelText("Autor");
const save = () => screen.getByRole("button", { name: /Adaugă|Salvează/ });

describe("BookFormDialog — author suggestions", () => {
  it("suggests authors already in the library as the field is typed", async () => {
    const { user } = renderForm();

    await user.click(author());
    await user.type(author(), "frank");

    expect(await screen.findByRole("button", { name: "Frank Herbert" })).toBeInTheDocument();
    // Not repeated once per book — the list is of distinct authors.
    expect(screen.getAllByRole("button", { name: "Frank Herbert" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Isaac Asimov" })).not.toBeInTheDocument();
  });

  it("fills the field with the suggestion's exact spelling on selection", async () => {
    const { calls, user } = renderForm();

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await user.type(author(), "frank herb");
    await user.click(await screen.findByRole("button", { name: "Frank Herbert" }));

    expect(author()).toHaveValue("Frank Herbert");

    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ author: "Frank Herbert" }),
    );
  });

  it("is still just a suggestion — typing a name of your own is not blocked", async () => {
    const { calls, user } = renderForm();

    await user.type(screen.getByLabelText("Titlu"), "A New Book");
    await user.type(author(), "Someone New");
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ author: "Someone New" }),
    );
  });

  it("shows nothing for a name with no match in the library", async () => {
    const { user } = renderForm();

    await user.type(author(), "Ursula");

    expect(screen.queryByRole("button", { name: /Herbert|Asimov/ })).not.toBeInTheDocument();
  });

  it("does not suggest the name already fully typed", async () => {
    const { user } = renderForm();

    await user.type(author(), "Isaac Asimov");

    expect(screen.queryByRole("button", { name: "Isaac Asimov" })).not.toBeInTheDocument();
  });

  it("closes the dropdown once a suggestion is picked, rather than reopening it", async () => {
    const { user } = renderForm();

    await user.type(author(), "frank");
    await user.click(await screen.findByRole("button", { name: "Frank Herbert" }));

    expect(screen.queryByRole("button", { name: "Frank Herbert" })).not.toBeInTheDocument();
  });

  it("offers suggestions while editing too, from the same shared field", async () => {
    const { user } = renderForm(makeBook({ author: "Isaac" }));

    await user.clear(author());
    await user.type(author(), "isaac");

    expect(await screen.findByRole("button", { name: "Isaac Asimov" })).toBeInTheDocument();
  });
});
