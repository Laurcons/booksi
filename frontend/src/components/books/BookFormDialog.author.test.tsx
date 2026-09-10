import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthorSuggestion } from "@bookcsi/shared";
import {
  failWith,
  makeAuthor,
  makeBook,
  renderWithQuery,
  stubApi,
  type ApiCall,
} from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

/**
 * §D51 — the Autor tab: the picker, the deliberate create, the delete, the
 * biography and what one Save does with two entities.
 *
 * This replaces `BookFormDialog.author-suggestions.test.tsx`, which tested the
 * opposite design and could not simply be adapted: it asserted that typing a
 * name and saving sent that *string*, which is precisely the behaviour §D51
 * removes. Every test here is about the rule that replaced it — the box holds a
 * name, the form holds an id, and a name becomes an author only when somebody
 * clicks to say so.
 */

const HERBERT: AuthorSuggestion = {
  id: "author-frank-herbert",
  name: "Frank Herbert",
  bookCount: 3,
};

const CALINESCU: AuthorSuggestion = {
  id: "author-calinescu",
  name: "George Călinescu",
  bookCount: 1,
};

/** An author nothing points at — the one case that skips the confirmation. */
const ORPHAN: AuthorSuggestion = {
  id: "author-orphan",
  name: "Nimeni Nimeni",
  bookCount: 0,
};

const AUTHORS = [HERBERT, CALINESCU, ORPHAN];

/**
 * The API, filtered the way the real route filters: case- and
 * diacritic-insensitively, because the whole "should the create row appear?"
 * question depends on the client and the server folding names the same way.
 */
function matching(url: string): AuthorSuggestion[] {
  const q = new URL(url, "http://x").searchParams.get("q");

  if (q === null || q === "") {
    return AUTHORS;
  }

  const needle = fold(q);

  return AUTHORS.filter((author) => fold(author.name).includes(needle));
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const defaults = (call: ApiCall): unknown => {
  if (call.url.includes("isbn-duplicates")) return [];
  if (call.url.includes("/authors?") || call.url.endsWith("/authors")) {
    return matching(call.url);
  }
  if (call.url.includes("/authors/")) {
    return { ...makeAuthor("Frank Herbert"), bookCount: 3 };
  }
  if (call.url.includes("/books?")) return [];
  return makeBook();
};

function renderForm(
  book?: Parameters<typeof BookFormDialog>[0]["book"],
  respond: (call: ApiCall) => unknown = defaults,
) {
  const calls = stubApi(respond);
  const onClose = vi.fn();

  const { user } = renderWithQuery(
    <BookFormDialog book={book} onClose={onClose} />,
  );

  return { calls, user, onClose };
}

/**
 * The Autor tab is not the one the dialog opens on.
 *
 * Matched by prefix rather than exactly: a dirty tab announces itself ("Autor
 * are modificări nesalvate"), so an exact name stops finding the tab as soon as
 * anything on it has been edited — which is precisely the state the
 * round-trip tests need to click it in.
 */
async function openAuthorTab(user: ReturnType<typeof renderForm>["user"]) {
  await user.click(screen.getByRole("tab", { name: /^Autor/ }));
}

/** The tab the dialog opens on, matched by prefix for the same reason. */
async function openBookTab(user: ReturnType<typeof renderForm>["user"]) {
  await user.click(screen.getByRole("tab", { name: /^Carte/ }));
}

/**
 * By role, not by label text.
 *
 * `getByLabelText("Autor")` matches two things now, and both are correct
 * markup: the picker's input, and the **tab panel**, which is
 * `aria-labelledby` the tab button whose name is also "Autor". Asking for the
 * textbox is the query that means what this suite means.
 */
const authorBox = () => screen.getByRole("textbox", { name: "Autor" });

const writes = (calls: ApiCall[]) => calls.filter((call) => call.method !== "GET");

/**
 * The `✕` on one dropdown row, by its own accessible name.
 *
 * Located directly rather than by finding the row's text first: the dialog
 * header also prints the author's name while editing, so a text query for
 * "Frank Herbert" matches two places. The delete button names the author it is
 * about, which is exactly the locator this needs — and it is the same string a
 * screen-reader user hears.
 */
function deleteRow(author: AuthorSuggestion) {
  return screen.findByRole("button", { name: `Șterge autorul ${author.name}` });
}

describe("BookFormDialog — the author tab (§D51)", () => {
  /**
   * The author field is on both tabs, and it is **one** field: the Carte tab
   * has it because cover/title/author/ISBN is how a book introduces itself and
   * because that is where a fill or a scan puts an author, and the Autor tab
   * has it because noticing you are reading the wrong person's biography is
   * exactly when you want to change who it is about.
   *
   * Only one panel is mounted at a time, so `authorBox()` is unambiguous — the
   * claim here is that whichever copy you arrive at shows the same selection.
   */
  it("shows the author on both tabs, as one field", async () => {
    const { user } = renderForm(makeBook({ author: makeAuthor("Frank Herbert") }));

    // The identity block, straight after the title.
    expect(authorBox()).toHaveValue("Frank Herbert");

    await openAuthorTab(user);
    expect(authorBox()).toHaveValue("Frank Herbert");

    // Changed on the Autor tab…
    await user.clear(authorBox());
    await user.type(authorBox(), "Călinescu");
    await user.click(await screen.findByRole("button", { name: /^George Călinescu/ }));

    // …and the Carte tab's copy is the same field, not a stale second one.
    await openBookTab(user);
    expect(authorBox()).toHaveValue("George Călinescu");
  });

  it("asks the server for matches rather than filtering the loaded books", async () => {
    const { calls, user } = renderForm();
    await openAuthorTab(user);

    await user.type(authorBox(), "herb");

    await waitFor(() =>
      expect(calls.some((call) => call.url.includes("/authors?q=herb"))).toBe(true),
    );
    expect(await screen.findByText("Frank Herbert")).toBeInTheDocument();
  });

  it("sends the chosen author's id, never a name", async () => {
    const { calls, user } = renderForm(makeBook({ author: null }));
    await openAuthorTab(user);

    await user.type(authorBox(), "herb");
    await user.click(await screen.findByText("Frank Herbert"));

    await user.click(screen.getByRole("button", { name: "Salvează" }));

    await waitFor(() => {
      const write = writes(calls).at(-1);
      expect(write?.body).toMatchObject({ authorId: HERBERT.id });
      expect(write?.body).not.toHaveProperty("author");
    });
  });

  /**
   * The rule the whole control exists for, and §D49 gives it a sharper edge
   * than expected: typing a name nobody confirmed leaves the form **clean**, so
   * the dialog does not even offer a Save. There is nothing to write, because
   * text in the box is a query and not a value.
   *
   * Asserted through the footer rather than by saving and inspecting a payload,
   * because that is the stronger claim: not "the name is dropped on the way
   * out" but "no change was ever registered".
   */
  it("does not create an author, or dirty the form, from typed text alone", async () => {
    const { calls, user } = renderForm(makeBook({ author: null }));
    await openAuthorTab(user);

    await user.type(authorBox(), "Cineva Nou");

    // §D49 — while editing, Save appears only once something is unsaved.
    expect(screen.queryByRole("button", { name: "Salvează" })).not.toBeInTheDocument();

    // And nothing was created behind the reader's back while they typed.
    expect(
      calls.some((call) => call.method === "POST" && call.url.endsWith("/authors")),
    ).toBe(false);
    expect(writes(calls)).toHaveLength(0);
  });

  it("leaves nothing typed in the box on blur", async () => {
    const { user } = renderForm(makeBook({ author: makeAuthor("Frank Herbert") }));
    await openAuthorTab(user);

    await user.clear(authorBox());
    await user.type(authorBox(), "Frnak Herbet");
    await user.tab();

    // Back to the author the form actually holds — the typed near-miss is gone.
    await waitFor(() => expect(authorBox()).toHaveValue("Frank Herbert"));
  });

  it("creates an author on a deliberate click, and selects it", async () => {
    const created = { id: "author-new", name: "Cineva Nou", biography: null };
    const { calls, user } = renderForm(makeBook({ author: null }), (call) =>
      call.method === "POST" && call.url.endsWith("/authors") ? created : defaults(call),
    );
    await openAuthorTab(user);

    await user.type(authorBox(), "Cineva Nou");

    // Worded with the name, so a misspelling is visible in the button itself.
    await user.click(
      await screen.findByRole("button", { name: /Creează autorul „Cineva Nou”/ }),
    );

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "POST" &&
            call.url.endsWith("/authors") &&
            (call.body as { name?: string } | undefined)?.name === "Cineva Nou",
        ),
      ).toBe(true),
    );

    expect(authorBox()).toHaveValue("Cineva Nou");
    expect(await screen.findByText(/a fost creat/)).toBeInTheDocument();
  });

  /**
   * The client's "is this new?" test has to fold names exactly as the unique
   * index does, or it offers to create a row the database resolves to an
   * existing one. Both foldings are checked, because they fail separately.
   */
  it.each([
    ["case", "frank herbert"],
    ["diacritics", "george calinescu"],
  ])("offers no create row when the name already exists, ignoring %s", async (_label, typed) => {
    const { user } = renderForm();
    await openAuthorTab(user);

    await user.type(authorBox(), typed);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Creează autorul/ })).not.toBeInTheDocument(),
    );
  });

  it("deletes an author nobody's books point at without asking", async () => {
    const { calls, user } = renderForm();
    await openAuthorTab(user);

    await user.click(authorBox());
    await user.click(await deleteRow(ORPHAN));

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.method === "DELETE" && call.url.endsWith(`/authors/${ORPHAN.id}`),
        ),
      ).toBe(true),
    );
  });

  it("asks first when books would lose their author, and says how many", async () => {
    const { calls, user } = renderForm();
    await openAuthorTab(user);

    await user.click(authorBox());
    await user.click(await deleteRow(HERBERT));

    // The count is the whole point of the sentence.
    expect(await screen.findByText(/3 cărți rămân fără autor/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Șterge" }));

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.method === "DELETE" && call.url.endsWith(`/authors/${HERBERT.id}`),
        ),
      ).toBe(true),
    );
  });

  it("says how far a biography edit reaches, with the count", async () => {
    const { user } = renderForm(makeBook({ author: makeAuthor("Frank Herbert") }));
    await openAuthorTab(user);

    expect(
      await screen.findByText(/Se aplică tuturor celor 3 cărți ale tale de Frank Herbert/),
    ).toBeInTheDocument();
  });

  it("saves the biography to the author, not to the book", async () => {
    const { calls, user } = renderForm(makeBook({ author: makeAuthor("Frank Herbert") }));
    await openAuthorTab(user);

    await user.type(screen.getByLabelText("Biografie"), "Autor american de SF.");
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "PATCH" &&
            call.url.endsWith(`/authors/${HERBERT.id}`) &&
            (call.body as { biography?: string } | undefined)?.biography ===
              "Autor american de SF.",
        ),
      ).toBe(true),
    );

    // And never as a field of the book.
    for (const call of writes(calls)) {
      if (call.url.includes("/books")) {
        expect(call.body).not.toHaveProperty("authorBiography");
        expect(call.body).not.toHaveProperty("biography");
      }
    }
  });

  it("does not rewrite an untouched biography", async () => {
    const { calls, user } = renderForm(
      makeBook({ author: makeAuthor("Frank Herbert", { biography: "Deja scrisă." }) }),
    );
    await openAuthorTab(user);

    await user.click(screen.getByRole("tab", { name: "Carte" }));
    await user.type(screen.getByLabelText("Titlu"), " (ed. nouă)");
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    await waitFor(() => expect(writes(calls).length).toBeGreaterThan(0));

    expect(calls.some((call) => call.method === "PATCH" && call.url.includes("/authors/"))).toBe(
      false,
    );
  });

  /**
   * §D51's partial-save rule, and the reason the toast system exists at all.
   * The dialog stays open so the half that failed can be retried, and the
   * message names which half survived rather than saying "could not save".
   */
  it("reports honestly when the author saved and the book did not", async () => {
    const { calls, user, onClose } = renderForm(
      makeBook({ author: makeAuthor("Frank Herbert") }),
      (call) => {
        if (call.method === "PATCH" && call.url.includes("/books/")) {
          return failWith(500, "boom");
        }
        return defaults(call);
      },
    );
    await openAuthorTab(user);

    await user.type(screen.getByLabelText("Biografie"), "Ceva.");
    await user.click(screen.getByRole("tab", { name: "Carte" }));
    await user.type(screen.getByLabelText("Titlu"), "!");
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    expect(
      await screen.findByText(/Datele autorului s-au salvat, dar cartea nu/),
    ).toBeInTheDocument();

    // And what reached the author is what was typed. Worth asserting rather
    // than trusting: this test passed for a while with the biography going out
    // empty, because the tab switch above overwrote it on the way past and left
    // the field looking dirty anyway.
    expect(
      calls.some(
        (call) =>
          call.method === "PATCH" &&
          call.url.includes("/authors/") &&
          (call.body as { biography?: string } | undefined)?.biography === "Ceva.",
      ),
    ).toBe(true);

    // Still open, because the book's edits are still unsaved.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the field when the selected author is deleted", async () => {
    const { user } = renderForm(makeBook({ author: makeAuthor("Frank Herbert") }));
    await openAuthorTab(user);

    await user.click(authorBox());
    await user.click(await deleteRow(HERBERT));
    await user.click(screen.getByRole("button", { name: "Șterge" }));

    await waitFor(() => expect(authorBox()).toHaveValue(""));
    // The biography box goes with it: there is no author to write about.
    expect(screen.queryByLabelText("Biografie")).not.toBeInTheDocument();
  });

  /**
   * The bug this file's seeding logic was rewritten for.
   *
   * Every tab switch unmounts the panel, so an effect that seeded the biography
   * from the fetched author ran again on the way back in and replaced whatever
   * had been typed. The biography is now poured in by the *event* that changes
   * the author, so a remount pours nothing.
   */
  it("keeps an unsaved biography across a tab switch", async () => {
    const { user } = renderForm(
      makeBook({ author: makeAuthor("Frank Herbert", { biography: "Deja scrisă." }) }),
    );
    await openAuthorTab(user);

    // Wait for the author's row, so the test is about the remount rather than
    // about a response that has not landed yet.
    await screen.findByText(/Se aplică tuturor celor 3 cărți/);

    await user.clear(screen.getByLabelText("Biografie"));
    await user.type(screen.getByLabelText("Biografie"), "Rescrisă de mine.");

    await openBookTab(user);
    await openAuthorTab(user);

    expect(screen.getByLabelText("Biografie")).toHaveValue("Rescrisă de mine.");
  });

  /**
   * And the edit that survived is the one that gets saved.
   *
   * A separate claim from the test above, because the failure had two halves:
   * `setValue` with no options leaves `dirtyFields` alone, so the overwritten
   * field still counted as changed and Save wrote the *stored* text back over
   * itself — green tab dot, successful request, nothing saved.
   */
  it("saves the biography that survived the tab switch", async () => {
    const { calls, user } = renderForm(
      makeBook({ author: makeAuthor("Frank Herbert", { biography: "Deja scrisă." }) }),
    );
    await openAuthorTab(user);
    await screen.findByText(/Se aplică tuturor celor 3 cărți/);

    await user.clear(screen.getByLabelText("Biografie"));
    await user.type(screen.getByLabelText("Biografie"), "Rescrisă de mine.");

    await openBookTab(user);
    await user.click(screen.getByRole("button", { name: "Salvează" }));

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "PATCH" &&
            call.url.endsWith(`/authors/${HERBERT.id}`) &&
            (call.body as { biography?: string } | undefined)?.biography ===
              "Rescrisă de mine.",
        ),
      ).toBe(true),
    );
  });

  /**
   * The other half of the rule: a *real* switch of author must still replace
   * the box, or the reader would write one person's prose onto another. This is
   * the assertion that stops the fix above from being applied too widely.
   */
  it("replaces the biography when the author changes", async () => {
    const { user } = renderForm(
      makeBook({ author: makeAuthor("Frank Herbert", { biography: "Deja scrisă." }) }),
      (call) => {
        if (call.url.endsWith(`/authors/${CALINESCU.id}`)) {
          return {
            ...makeAuthor("George Călinescu", { biography: "Criticul." }),
            bookCount: 1,
          };
        }
        return defaults(call);
      },
    );
    await openAuthorTab(user);

    expect(screen.getByLabelText("Biografie")).toHaveValue("Deja scrisă.");

    await user.clear(authorBox());
    await user.type(authorBox(), "Călinescu");
    await user.click(await screen.findByRole("button", { name: /^George Călinescu/ }));

    await waitFor(() =>
      expect(screen.getByLabelText("Biografie")).toHaveValue("Criticul."),
    );
  });
});
