import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Book, BookSuggestion, OpenLibraryResult } from "@bookcsi/shared";
import {
  failWith,
  lastWrite,
  makeBook,
  renderWithQuery,
  stubApi,
  type ApiCall,
} from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

const dune: OpenLibraryResult = {
  workKey: "OL45804W",
  editionKey: "OL7353617M",
  title: "Dune",
  author: "Frank Herbert",
  firstPublishYear: 1965,
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

const duneEdition: BookSuggestion = {
  title: "Dune",
  author: "Frank Herbert",
  isbn: "9780441013593",
  totalPages: 620,
  publisher: null,
  publicationYear: null,
  format: null,
  olEditionKey: "OL7353617M",
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

/**
 * Sprint 4 through the form it actually lives in.
 *
 * The seam is `fetch`, as everywhere else in this suite: what the dialog
 * *sends* is half of what it does, and the two things most worth pinning here
 * are both about requests rather than pixels — that the edition key travels
 * with the create (§D8 has nothing to download without it), and that the
 * duplicate check goes out before the ISBN lookup.
 */
function renderForm(
  respond: (call: ApiCall) => unknown = () => makeBook(),
  book?: Book,
) {
  const calls = stubApi(respond);

  return {
    calls,
    ...renderWithQuery(<BookFormDialog book={book} onClose={vi.fn()} />),
  };
}

const defaults = (call: ApiCall) => {
  if (call.url.includes("isbn-duplicates")) return [];
  if (call.url.includes("/openlibrary/search")) return [dune];
  if (call.url.includes("/openlibrary/editions/")) return duneEdition;
  if (call.url.includes("/openlibrary/isbn/")) return duneEdition;
  // AuthorInput's own `useBooks` call, for its suggestion list.
  if (call.url.includes("/books?")) return [];
  return makeBook();
};

const searchBox = () => screen.getByLabelText(/Caută în Open Library/);
const save = () => screen.getByRole("button", { name: /Salvează|Adaugă/ });

describe("BookFormDialog — searching Open Library (S4.1)", () => {
  it("fills the form from a chosen result", async () => {
    const { user } = renderForm(defaults);

    await user.type(searchBox(), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));

    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));
    expect(screen.getByLabelText("Autor")).toHaveValue("Frank Herbert");
    // §D7 — the edition is where the ISBN and the page count come from, and it
    // takes the second request to get them.
    expect(screen.getByLabelText(/ISBN/)).toHaveValue("9780441013593");
    expect(screen.getByLabelText("Pagini")).toHaveValue(620);
  });

  it("sends the edition key, which is what makes the cover arrive (§D8)", async () => {
    const { calls, user } = renderForm(defaults);

    await user.type(searchBox(), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));
    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));

    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({
        title: "Dune",
        olEditionKey: "OL7353617M",
      }),
    );
  });

  it("leaves the fields editable after a fill (S1.3)", async () => {
    const { calls, user } = renderForm(defaults);

    await user.type(searchBox(), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));
    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));

    const title = screen.getByLabelText("Titlu");
    await user.clear(title);
    await user.type(title, "Dune Messiah");
    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ title: "Dune Messiah" }),
    );
  });

  it("still adds the book when the edition lookup fails", async () => {
    // Degradation: the title and author are already in from the search row, so
    // a dead edition endpoint costs the ISBN and the page count, not the book.
    const { calls, user } = renderForm((call) =>
      call.url.includes("/openlibrary/editions/")
        ? failWith(503, "nu răspunde", "OPEN_LIBRARY_UNAVAILABLE")
        : defaults(call),
    );

    await user.type(searchBox(), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));
    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));

    await user.click(save());

    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ title: "Dune" }));
  });

  it("leaves the manual form usable when the search itself fails (S1.1)", async () => {
    // The band used to carry a sentence promising this; §D48 removed it, so the
    // promise is kept here instead — and this is the better place for it, since
    // the fields it is about only exist in the dialog.
    const { calls, user } = renderForm((call) =>
      call.url.includes("/openlibrary/search")
        ? failWith(503, "Open Library nu răspunde", "OPEN_LIBRARY_UNAVAILABLE")
        : defaults(call),
    );

    await user.type(screen.getByLabelText(/Caută în Open Library/), "dune");
    expect(await screen.findByText(/nu răspunde/)).toBeInTheDocument();

    // Typed by hand, over the failure, and saved.
    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await user.click(screen.getByRole("button", { name: "Adaugă" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/books"))).toBe(
        true,
      ),
    );
  });

  it("is not offered while editing a book", () => {
    // Editing a book is not the moment to be shown a different one.
    renderForm(defaults, makeBook());

    expect(screen.queryByLabelText(/Caută în Open Library/)).not.toBeInTheDocument();
  });
});

describe("BookFormDialog — filling from an ISBN (S4.2)", () => {
  const typeIsbn = async (
    user: ReturnType<typeof renderWithQuery>["user"],
    isbn = "978-0-441-01359-3",
  ) => {
    await user.type(screen.getByLabelText(/ISBN/), isbn);
  };

  it("checks for a duplicate before it looks anything up", async () => {
    const { calls, user } = renderForm(defaults);

    await typeIsbn(user);
    await screen.findByText(/Completat din Open Library/);

    const order = calls
      .map((call) => call.url)
      .filter((url) => url.includes("isbn-duplicates") || url.includes("/openlibrary/isbn/"));

    // The ordering the story asks for, and the reason it is enforced with
    // `enabled` rather than left to whichever request happens to win.
    expect(order[0]).toContain("isbn-duplicates");
    expect(order.at(-1)).toContain("/openlibrary/isbn/");
  });

  it("fills the empty fields", async () => {
    const { user } = renderForm(defaults);

    await typeIsbn(user);

    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));
    expect(screen.getByLabelText("Pagini")).toHaveValue(620);
  });

  it("does not overwrite what the user already typed", async () => {
    // Typing an ISBN is "fill in the gaps", not "replace this book" — unlike
    // picking a search result, which is explicit.
    const { user } = renderForm(defaults);

    await user.type(screen.getByLabelText("Titlu"), "Titlul meu");
    await typeIsbn(user);

    await waitFor(() => expect(screen.getByLabelText("Pagini")).toHaveValue(620));
    expect(screen.getByLabelText("Titlu")).toHaveValue("Titlul meu");
  });

  it("does not look up a half-typed ISBN", async () => {
    const { calls, user } = renderForm(defaults);

    await typeIsbn(user, "97804");
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("isbn-duplicates"))).toBe(true),
    );

    expect(calls.filter((c) => c.url.includes("/openlibrary/isbn/"))).toHaveLength(0);
  });

  it("says so clearly when the ISBN is unknown, and still saves", async () => {
    const { calls, user } = renderForm((call) =>
      call.url.includes("/openlibrary/isbn/")
        ? failWith(
            404,
            "Open Library nu cunoaște cartea asta. Completeaz-o manual.",
            "OPEN_LIBRARY_NOT_FOUND",
          )
        : defaults(call),
    );

    await user.type(screen.getByLabelText("Titlu"), "Ceva scris de mână");
    await typeIsbn(user);

    // A 404 is the API's own sentence and reaches the user verbatim; the story
    // asks for a clear message and a form that stays manual.
    expect(await screen.findByText(/nu cunoaște cartea asta/)).toBeInTheDocument();

    await user.click(save());

    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ title: "Ceva scris de mână" }),
    );
  });

  it("does not fill anything when the dialog merely opens on a stored ISBN", async () => {
    // An edit dialog that starts rewriting fields the moment it appears is its
    // own kind of wrong, so the lookup waits for the field to be touched.
    const { calls } = renderForm(defaults, makeBook({ isbn: "9780441013593" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("isbn-duplicates"))).toBe(true),
    );

    expect(calls.filter((c) => c.url.includes("/openlibrary/isbn/"))).toHaveLength(0);
  });
});

describe("BookFormDialog — the cover (S4.3)", () => {
  /**
   * The cover is the control now — a picture with a file input behind it and no
   * heading over it (`CoverWell`) — so these two used to assert on a "Copertă"
   * label that no longer exists. They assert on the behaviour that actually
   * differs between the two modes instead, which is the better test anyway:
   * editing PUTs the file straight to the book, adding cannot.
   */
  it("offers the upload while editing", async () => {
    const { calls, user } = renderForm(
      (call) =>
        call.url.includes("/cover") ? { coverUrl: "/covers/book-1?v=99" } : defaults(call),
      makeBook(),
    );

    const file = new File(["x"], "coperta.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);

    await waitFor(() =>
      expect(calls.some((call) => call.url.includes("/books/book-1/cover"))).toBe(true),
    );
  });

  it("offers a picker rather than the upload while adding, since there is no book yet to PUT to", async () => {
    const { calls, user } = renderForm(defaults);

    const file = new File(["x"], "coperta.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);

    // Previewed, held, and sent only once the create request has answered with
    // an id — see `BookFormDialog.cover-on-create.test.tsx`.
    expect(await screen.findByAltText("Previzualizarea copertei")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("draws the stored cover when there is one", () => {
    renderForm(defaults, makeBook({ coverUrl: "/covers/book-1?v=42" }));

    const cover = screen.getByAltText(/Coperta cărții/);
    expect(cover).toHaveAttribute("src", expect.stringContaining("/covers/book-1?v=42"));
    expect(cover).toHaveAttribute("crossorigin", "use-credentials");
  });

  it("uploads the chosen file to the book's own route", async () => {
    const { calls, user } = renderForm(
      (call) =>
        call.url.includes("/cover") ? { coverUrl: "/covers/book-1?v=99" } : defaults(call),
      makeBook(),
    );

    const file = new File(["not really a png"], "coperta.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);

    await waitFor(() => {
      const upload = calls.find((call) => call.method === "PUT");
      expect(upload?.url).toContain("/books/book-1/cover");
      // jsdom has no `createImageBitmap`, so the resize takes its fallback path
      // and the original file goes up — which is exactly the behaviour a
      // browser without canvas support would produce.
      expect(upload?.headers["Content-Type"]).toBe("image/png");
    });
  });

  it("shows the new cover rather than the cached old one", async () => {
    // §D26: the book in hand still carries the previous version, and that URL
    // is cached for a year — drawing it again would look like nothing happened.
    const { user } = renderForm(
      (call) =>
        call.url.includes("/cover") ? { coverUrl: "/covers/book-1?v=99" } : defaults(call),
      makeBook({ coverUrl: "/covers/book-1?v=1" }),
    );

    const file = new File(["x"], "coperta.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);

    await waitFor(() =>
      expect(screen.getByAltText(/Coperta cărții/)).toHaveAttribute(
        "src",
        expect.stringContaining("v=99"),
      ),
    );
  });

  it("reports a refused upload without losing the dialog", async () => {
    const { user } = renderForm(
      (call) =>
        call.url.includes("/cover")
          ? failWith(
              413,
              "Imaginea depășește 5MB. Micșoreaz-o și încearcă din nou.",
              "COVER_TOO_LARGE",
            )
          : defaults(call),
      makeBook(),
    );

    const file = new File(["x"], "uriasa.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);

    expect(await screen.findByText(/depășește 5MB/)).toBeInTheDocument();
    expect(screen.getByLabelText("Titlu")).toBeInTheDocument();
  });
});
