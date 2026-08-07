import { describe, expect, it } from "vitest";
import { chooseUi, isKoboUserAgent } from "./ui-choice";

/** The 2012 Kobo Touch string, the only one documented in public. */
const KOBO_TOUCH =
  "Mozilla/5.0 (Linux; U; Android 2.0; en-us;) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1 (Kobo Touch)";

const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("isKoboUserAgent", () => {
  it("matches the model suffix Kobo appends", () => {
    expect(isKoboUserAgent(KOBO_TOUCH)).toBe(true);
    expect(isKoboUserAgent("… Safari/533.1 (Kobo Libra Colour)")).toBe(true);
  });

  it("does not match an ordinary desktop browser", () => {
    expect(isKoboUserAgent(CHROME)).toBe(false);
  });

  it("treats an absent User-Agent as not a Kobo", () => {
    // curl with no flags, most bots. The safe default is the full app: sending
    // a real browser to a JS-less UI is worse than the reverse.
    expect(isKoboUserAgent(undefined)).toBe(false);
  });

  it("does not fire on a word that merely contains kobo", () => {
    expect(isKoboUserAgent("Mozilla/5.0 (Kobold/1.0)")).toBe(false);
  });
});

describe("chooseUi", () => {
  it("sends a Kobo to the lite interface", () => {
    expect(chooseUi({ userAgent: KOBO_TOUCH, cookie: undefined })).toEqual({
      ui: "lite",
      reason: "user-agent",
    });
  });

  it("sends everything else to the full interface", () => {
    expect(chooseUi({ userAgent: CHROME, cookie: undefined })).toEqual({
      ui: "full",
      reason: "default",
    });
  });

  it("lets the cookie override the User-Agent in both directions", () => {
    // Without this the lite UI could only ever be opened on the one device
    // that produces the right string, which is not a thing anyone can develop.
    expect(chooseUi({ userAgent: CHROME, cookie: "lite" }).ui).toBe("lite");
    expect(chooseUi({ userAgent: KOBO_TOUCH, cookie: "full" }).ui).toBe("full");
  });

  it("ignores a cookie value that is neither", () => {
    expect(chooseUi({ userAgent: KOBO_TOUCH, cookie: "banana" })).toEqual({
      ui: "lite",
      reason: "user-agent",
    });
  });
});
