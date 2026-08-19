import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  matchLocale,
  parseAcceptLanguage,
  resolveLocale,
} from "./locale.js";

describe("parseAcceptLanguage", () => {
  it("ranks by q, not by the order the tags are written in", () => {
    // The whole reason this function exists rather than a `split(",")`: the
    // header reads English-first and asks for Romanian.
    expect(parseAcceptLanguage("en;q=0.5,ro;q=0.9")).toEqual(["ro", "en"]);
  });

  it("treats a missing q as 1, which is how browsers write the first entry", () => {
    expect(parseAcceptLanguage("ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7")).toEqual([
      "ro-RO",
      "ro",
      "en-US",
      "en",
    ]);
  });

  it("keeps document order for equal weights", () => {
    expect(parseAcceptLanguage("de;q=0.8,ro;q=0.8,en;q=0.8")).toEqual([
      "de",
      "ro",
      "en",
    ]);
  });

  it("drops q=0 — the one case where naming a language refuses it", () => {
    expect(parseAcceptLanguage("en,ro;q=0")).toEqual(["en"]);
  });

  it("drops the * wildcard, which cannot win a first-match search", () => {
    expect(parseAcceptLanguage("*")).toEqual([]);
    expect(parseAcceptLanguage("ro,*;q=0.5")).toEqual(["ro"]);
  });

  it("survives an absent or empty header", () => {
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(",,")).toEqual([]);
  });

  it("keeps a language whose q is unparseable, at the default weight", () => {
    // Deliberate, not incidental: the entry names a language legibly and only
    // its weight is broken, so discarding the whole thing would lose a
    // preference the client did manage to express. Same reading HTTP parsers
    // take of any unrecognised parameter.
    expect(parseAcceptLanguage("ro;q=banana")).toEqual(["ro"]);
    expect(parseAcceptLanguage("de;q=0.9,ro;q=banana")).toEqual(["ro", "de"]);
  });

  it("tolerates the whitespace a hand-written header carries", () => {
    expect(parseAcceptLanguage(" en-GB ; q=0.7 , ro ; q=0.9 ")).toEqual([
      "ro",
      "en-GB",
    ]);
  });
});

describe("matchLocale", () => {
  it("matches on the primary subtag, ignoring region and case", () => {
    expect(matchLocale(["ro-RO"])).toBe("ro");
    expect(matchLocale(["EN-gb"])).toBe("en");
  });

  it("takes the first supported entry and does not scan past it for ro", () => {
    // The decision this codifies: a device set to English with Romanian further
    // down has expressed a preference. Scanning the whole list and preferring
    // `ro` would override it — and would disagree with the server, which sees a
    // header Safari may have trimmed.
    expect(matchLocale(["en-US", "en", "ro"])).toBe("en");
    expect(matchLocale(["ro-RO", "ro", "en-US"])).toBe("ro");
  });

  it("skips languages it cannot serve rather than giving up at the first one", () => {
    expect(matchLocale(["de-DE", "fr", "ro"])).toBe("ro");
  });

  it("falls back for an empty list or one with nothing recognisable", () => {
    expect(matchLocale([])).toBe(DEFAULT_LOCALE);
    expect(matchLocale(["de", "fr", "ja"])).toBe(DEFAULT_LOCALE);
  });

  it("defaults to English, not to the language every current account uses", () => {
    // Existing accounts carry `locale` on their row and never reach the
    // default; this constant is only consulted for a stranger.
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("lets a stored preference win over the request's header", () => {
    // Someone who chose Romanian on a borrowed English laptop chose Romanian.
    expect(resolveLocale("ro", "en-US,en;q=0.9")).toBe("ro");
    expect(resolveLocale("en", "ro-RO,ro;q=0.9")).toBe("en");
  });

  it("falls back to the header when there is no session to read", () => {
    expect(resolveLocale(null, "ro-RO,ro;q=0.9")).toBe("ro");
    expect(resolveLocale(undefined, "en-US")).toBe("en");
  });

  it("falls back to the default when there is neither", () => {
    expect(resolveLocale(null, undefined)).toBe(DEFAULT_LOCALE);
  });
});
