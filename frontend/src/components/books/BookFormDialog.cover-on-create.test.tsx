import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookSuggestion, OpenLibraryResult } from "@bookcsi/shared";
import {
  failWith,
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
  olEditionKey: "OL7353617M",
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

const defaults = (call: ApiCall) => {
  if (call.url.includes("isbn-duplicates")) return [];
  // AuthorInput's own `useBooks` call, for its suggestion list.
  if (call.url.includes("/books?")) return [];
  if (call.url.includes("/openlibrary/editions/")) return duneEdition;
  if (call.url.includes("/cover")) return { coverUrl: "/covers/book-1?v=1" };
  return makeBook();
};

/**
 * A cover picked while adding — there is no book id yet, so `CoverPicker`
 * only previews the file; the actual `PUT /books/{id}/cover` happens after
 * `POST /books` answers, once the new book's id exists.
 */
function renderForm(respond: (call: ApiCall) => unknown = defaults) {
  const calls = stubApi(respond);
  return { calls, ...renderWithQuery(<BookFormDialog onClose={vi.fn()} />) };
}

const save = () => screen.getByRole("button", { name: "Adaugă" });

const pickCover = async (
  user: ReturnType<typeof renderWithQuery>["user"],
  name = "coperta.png",
) => {
  const file = new File(["not really a png"], name, { type: "image/png" });
  await user.upload(screen.getByLabelText(/Încarcă o imagine/), file);
};

/**
 * The create request's own body — as opposed to `lastWrite`, which would pick
 * up the cover PUT that follows it (a raw image, so its `body` is `undefined`
 * and it would otherwise shadow the write actually worth asserting on).
 */
const createBody = (calls: ApiCall[]) =>
  calls.find((call) => call.method === "POST" && call.url.endsWith("/books"))?.body;

describe("BookFormDialog — cover at creation", () => {
  it("previews the picked file without uploading anything yet", async () => {
    const { calls, user } = renderForm();

    await pickCover(user);

    expect(await screen.findByAltText("Previzualizarea copertei")).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("/cover"))).toBe(false);
  });

  it("uploads the cover to the new book right after it is created", async () => {
    const { calls, user } = renderForm();

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await pickCover(user);
    await user.click(save());

    await waitFor(() => expect(createBody(calls)).toMatchObject({ title: "Dune" }));

    await waitFor(() => {
      const upload = calls.find((call) => call.method === "PUT");
      expect(upload?.url).toContain("/books/book-1/cover");
      expect(upload?.headers["Content-Type"]).toBe("image/png");
    });
  });

  it("still creates the book, and closes right away, when no cover was picked", async () => {
    const onClose = vi.fn();
    const calls = stubApi(defaults);
    const { user } = renderWithQuery(<BookFormDialog onClose={onClose} />);

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await user.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.some((call) => call.url.includes("/cover"))).toBe(false);
  });

  it("still creates the book and closes even if the cover upload fails", async () => {
    // Same best-effort posture as the Open Library cover fetch (§D8): the
    // create is not undone by a failure that is only about the picture.
    const onClose = vi.fn();
    const calls = stubApi((call) =>
      call.url.includes("/cover") ? failWith(500, "eroare") : defaults(call),
    );
    const { user } = renderWithQuery(<BookFormDialog onClose={onClose} />);

    await user.type(screen.getByLabelText("Titlu"), "Dune");
    await pickCover(user);
    await user.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createBody(calls)).toMatchObject({ title: "Dune" });
  });

  it("still uploads a manually picked file even when an Open Library edition was also chosen", async () => {
    // §D8: the server downloads the Open Library cover as part of creating
    // the book, before the create request answers — so a manual upload that
    // runs after always lands on top of it.
    const { calls, user } = renderForm((call) =>
      call.url.includes("/openlibrary/search") ? [dune] : defaults(call),
    );

    await user.type(screen.getByLabelText(/Caută în Open Library/), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));
    await waitFor(() => expect(screen.getByLabelText("Titlu")).toHaveValue("Dune"));

    await pickCover(user);
    await user.click(save());

    await waitFor(() =>
      expect(createBody(calls)).toMatchObject({ olEditionKey: "OL7353617M" }),
    );
    await waitFor(() => {
      const upload = calls.find((call) => call.method === "PUT");
      expect(upload?.url).toContain("/books/book-1/cover");
    });
  });
});
