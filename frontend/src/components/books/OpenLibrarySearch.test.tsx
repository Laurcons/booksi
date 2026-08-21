import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OpenLibraryResult } from "@bookcsi/shared";
import { failWith, renderWithQuery, stubApi } from "../../test/helpers";
import { OpenLibrarySearch } from "./OpenLibrarySearch";

const dune: OpenLibraryResult = {
  workKey: "OL45804W",
  editionKey: "OL7353617M",
  title: "Dune",
  author: "Frank Herbert",
  firstPublishYear: 1965,
  thumbnailUrl: "/openlibrary/covers/OL7353617M",
};

function renderSearch(respond: (url: string) => unknown) {
  const onSelect = vi.fn();
  const calls = stubApi((call) => respond(call.url));

  return { onSelect, calls, ...renderWithQuery(<OpenLibrarySearch onSelect={onSelect} />) };
}

const searchBox = () => screen.getByLabelText(/Caută în Open Library/);

describe("OpenLibrarySearch (S4.1)", () => {
  it("lists what came back, after the pause in typing", async () => {
    const { user } = renderSearch(() => [dune]);

    await user.type(searchBox(), "dune");

    // `findBy` outlasts the 300ms debounce, which is the behaviour under test
    // as much as the list is.
    expect(await screen.findByText("Dune")).toBeInTheDocument();
    expect(screen.getByText(/Frank Herbert · 1965/)).toBeInTheDocument();
  });

  it("searches once per pause, not once per keystroke", async () => {
    const { calls, user } = renderSearch(() => [dune]);

    await user.type(searchBox(), "dune");
    await screen.findByText("Dune");

    const searches = calls.filter((call) => call.url.includes("/openlibrary/search"));

    // Four characters, one request. Without the debounce this is where the
    // rate-limiting criterion quietly stops holding.
    expect(searches).toHaveLength(1);
    expect(searches[0].url).toContain("q=dune");
  });

  it("does not search on a single character", async () => {
    const { calls, user } = renderSearch(() => [dune]);

    // Typed one letter, then the rest. Waiting for the *second* search to land
    // is what makes this deterministic: if the single character had also gone
    // out, there would be two requests, and one of them would carry "d".
    await user.type(searchBox(), "d");
    await user.type(searchBox(), "une");
    await screen.findByText("Dune");

    const searches = calls.filter((c) => c.url.includes("/openlibrary/search"));
    expect(searches).toHaveLength(1);
    expect(searches[0].url).toContain("q=dune");
  });

  it("points thumbnails at our own API, never at Open Library", async () => {
    const { user } = renderSearch(() => [dune]);

    await user.type(searchBox(), "dune");
    await screen.findByText("Dune");

    // The rule the proxy exists for. An `<img>` at covers.openlibrary.org is
    // the frontend touching Open Library directly, whatever the network tab
    // says about who asked for it.
    const thumb = document.querySelector("img");
    expect(thumb?.getAttribute("src")).toContain("/openlibrary/covers/OL7353617M");
    expect(thumb?.getAttribute("src")).not.toContain("openlibrary.org");
    // Cross-origin images do not carry the session cookie unless told to, and
    // the route requires one.
    expect(thumb).toHaveAttribute("crossorigin", "use-credentials");
  });

  it("hands the chosen work up, edition and all (§D7)", async () => {
    const { onSelect, user } = renderSearch(() => [dune]);

    await user.type(searchBox(), "dune");
    await user.click(await screen.findByRole("button", { name: /Dune/ }));

    expect(onSelect).toHaveBeenCalledWith(dune);
  });

  it("says so plainly when there is nothing", async () => {
    const { user } = renderSearch(() => []);

    await user.type(searchBox(), "qwertyuiop");

    expect(await screen.findByText(/Niciun rezultat/)).toBeInTheDocument();
  });

  it("shows the API's own words when Open Library is down", async () => {
    // The degradation criterion: the message says the manual form still works,
    // and the manual form is directly underneath.
    const { user } = renderSearch(() =>
      failWith(
        503,
        "Open Library nu răspunde acum. Poți completa cartea manual.",
        "OPEN_LIBRARY_UNAVAILABLE",
      ),
    );

    await user.type(searchBox(), "dune");

    // Verbatim, despite being a 503. §D27's code is what gets it past the rule
    // that would otherwise flatten every 5xx into a generic apology — and this
    // is the message that rule was losing.
    expect(
      await screen.findByText(/Poți completa cartea manual/),
    ).toBeInTheDocument();
  });

  it("falls back to its own words when the failure has none", async () => {
    // An uncoded failure — a proxy's error page, a network drop — carries
    // nothing written for a user, so the component supplies the sentence.
    const { user } = renderSearch(() => failWith(500, "ECONNRESET"));

    await user.type(searchBox(), "dune");

    expect(
      await screen.findByText(/Completează cartea manual mai jos/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
  });

  it("keeps the manual form reachable while the band is in every state", async () => {
    const { user } = renderSearch(() =>
      failWith(503, "nu răspunde", "OPEN_LIBRARY_UNAVAILABLE"),
    );

    await user.type(searchBox(), "dune");
    await screen.findByText("nu răspunde");

    /*
      S1.1: the manual form is permanently available, including after Sprint 4.
      The sentence that used to say so is gone (§D48 — the fields say it by
      being fields), so what is asserted here is the part this component owns:
      a failed search leaves its own box usable. That the fields below stay
      editable is asserted where they exist, in
      `BookFormDialog.sprint4.test.tsx`.
    */
    expect(searchBox()).toBeEnabled();
  });

  it("drops a result with no default edition into the list anyway", async () => {
    // A work Open Library never resolved an edition for still has a title and
    // an author, and refusing to show it would be a book the user searched for
    // and cannot find.
    const { user } = renderSearch(() => [
      { ...dune, editionKey: null, thumbnailUrl: null, author: null, firstPublishYear: null },
    ]);

    await user.type(searchBox(), "dune");

    expect(await screen.findByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("autor necunoscut")).toBeInTheDocument();
  });
});
