import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BookSuggestion } from "@bookcsi/shared";
import { makeBook, renderWithQuery, stubApi, type ApiCall } from "../../test/helpers";
import { BookFormDialog } from "./BookFormDialog";

/**
 * §D43 — the join between the scanner and S4.2, which is the whole feature.
 *
 * The camera is not the interesting part here and is not present: `IsbnScanner`
 * is replaced by a button that reports an ISBN, because what this file is about
 * is what the *form* does with one. `IsbnScanner.test.tsx` covers the scanner
 * itself, and `e2e/isbn-scan.spec.ts` covers a real camera.
 *
 * The assertion that matters most is the least visible: a scanned ISBN has to be
 * written with `shouldDirty`, because S4.2's lookup is gated on
 * `dirtyFields.isbn`. Set quietly, the field would fill and nothing would be
 * fetched — indistinguishable, on screen, from Open Library being down.
 */
const SCANNED = "9780441013593";

const duneEdition: BookSuggestion = {
  title: "Dune",
  author: "Frank Herbert",
  isbn: SCANNED,
  totalPages: 620,
  publisher: "Nemira",
  publicationYear: 1965,
  format: null,
  olEditionKey: "OL7353617M",
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

vi.mock("./IsbnScanner", () => ({
  IsbnScanner: ({ onFound }: { onFound: (isbn: string) => void }) => (
    <button type="button" onClick={() => onFound(SCANNED)}>
      test-scan
    </button>
  ),
}));

const defaults = (call: ApiCall) => {
  if (call.url.includes("isbn-duplicates")) return [];
  if (call.url.includes("/openlibrary/isbn/")) return duneEdition;
  if (call.url.includes("/books?")) return [];
  return makeBook();
};

function renderForm(respond: (call: ApiCall) => unknown = defaults) {
  const calls = stubApi(respond);

  return { calls, ...renderWithQuery(<BookFormDialog onClose={vi.fn()} />) };
}

const scanButton = () => screen.getByRole("button", { name: "Scanează codul de bare" });
const isbnField = () => screen.getByLabelText(/ISBN/) as HTMLInputElement;

describe("BookFormDialog — scanning an ISBN (§D43)", () => {
  it("offers the camera beside the ISBN field", () => {
    renderForm();

    expect(scanButton()).toBeInTheDocument();
  });

  it("does not open the camera until it is asked to", () => {
    // The camera must not be a side effect of opening the add-book dialog.
    renderForm();

    expect(screen.queryByText("test-scan")).not.toBeInTheDocument();
  });

  it("opens and closes the scanner from the same button", async () => {
    const { user } = renderForm();

    await user.click(scanButton());
    expect(screen.getByText("test-scan")).toBeInTheDocument();

    await user.click(scanButton());
    expect(screen.queryByText("test-scan")).not.toBeInTheDocument();
  });

  it("puts the scanned ISBN in the field", async () => {
    const { user } = renderForm();

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    expect(isbnField().value).toBe(SCANNED);
  });

  it("closes the camera once it has an answer", async () => {
    const { user } = renderForm();

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    // One scan, one close — otherwise a second book wanders into a form that is
    // already about the first.
    expect(screen.queryByText("test-scan")).not.toBeInTheDocument();
  });

  it("looks the scanned ISBN up in Open Library, which typing it would too", async () => {
    const { user, calls } = renderForm();

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    // This is the `shouldDirty` assertion, from the outside: the request only
    // goes out because the field counts as user-changed.
    await waitFor(() =>
      expect(
        calls.some((call) => call.url.includes(`/openlibrary/isbn/${SCANNED}`)),
      ).toBe(true),
    );
  });

  it("asks about duplicates before asking Open Library", async () => {
    // S4.2's documented ordering, which the scanner must not skip past: "ai deja
    // această carte" is the more important answer and has to be on screen first.
    const { user, calls } = renderForm();

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    await waitFor(() =>
      expect(calls.some((call) => call.url.includes("/openlibrary/isbn/"))).toBe(true),
    );

    const duplicates = calls.findIndex((call) => call.url.includes("isbn-duplicates"));
    const lookup = calls.findIndex((call) => call.url.includes("/openlibrary/isbn/"));

    expect(duplicates).toBeGreaterThanOrEqual(0);
    expect(duplicates).toBeLessThan(lookup);
  });

  it("fills the rest of the book from the scan", async () => {
    const { user } = renderForm();

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    // The point of the feature: one barcode, a filled-in book.
    expect(await screen.findByDisplayValue("Dune")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByDisplayValue("620")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Nemira")).toBeInTheDocument();
  });

  it("leaves a title the user already typed alone", async () => {
    // `overwrite: false` (S4.2) is not bypassed by the scan: someone who typed a
    // title and then scanned the barcode wants the gaps filled, not their words
    // replaced.
    const { user } = renderForm();

    await user.type(screen.getByLabelText(/Titlu/), "Dune, ediția mea");
    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    await waitFor(() => expect(screen.getByDisplayValue("620")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Dune, ediția mea")).toBeInTheDocument();
  });

  it("keeps the scanned ISBN when Open Library has never heard of it", async () => {
    // A miss is the ordinary outcome for Romanian editions. The barcode was
    // still read correctly, and losing it would be the one unforgivable
    // outcome of a successful scan.
    const { user } = renderForm((call) => {
      if (call.url.includes("/openlibrary/isbn/")) {
        return { statusCode: 404, message: "not found" };
      }
      return defaults(call);
    });

    await user.click(scanButton());
    await user.click(screen.getByText("test-scan"));

    expect(isbnField().value).toBe(SCANNED);
  });
});
