/**
 * Which of the two frontends a request should get.
 *
 * The reverse proxy is what actually routes — this module does not sit in the
 * request path for the SPA at all. It exists because the rule has to be
 * written down somewhere that can be tested, and because this process needs to
 * explain its own answer on the probe page ("you are seeing the lite UI
 * because your User-Agent says Kobo").
 *
 * That means the rule is stated twice: here, and in `docker/kobo-routing.conf`
 * as nginx `map` blocks. Unavoidable with User-Agent routing — the decision has
 * to be made before a request reaches either app, and only the proxy is there.
 * `ui-choice.spec.ts` and the table in that conf file are meant to be read
 * together; changing one without the other is the failure mode to watch for.
 */

export type Ui = "lite" | "full";

/** Set by `/ui/lite` and `/ui/full`. Read by the proxy, not just by this app. */
export const UI_COOKIE = "ui";

/**
 * Kobo's browser appends the device model in parentheses — `(Kobo Touch)`,
 * `(Kobo Libra Colour)` — so the brand name is the whole signal.
 *
 * Deliberately narrow. The tempting alternative is to sniff for "old WebKit"
 * generally and route anything ancient to the lite UI, but the version numbers
 * that would catch (`AppleWebKit/533`) are also what a pile of unrelated
 * embedded browsers and bots report, and misrouting a real browser to a
 * JS-less UI is a worse failure than the reverse. Until `/probe` reports what
 * the Libra Colour actually sends, one word is the honest amount to match.
 */
export function isKoboUserAgent(userAgent: string | undefined): boolean {
  return userAgent !== undefined && /\bkobo\b/i.test(userAgent);
}

export interface UiChoice {
  ui: Ui;
  /** Why, in the words the probe page prints back. */
  reason: "cookie" | "user-agent" | "default";
}

/**
 * The cookie beats the User-Agent, and that ordering is the whole reason the
 * cookie exists: without an override the lite UI is unreachable from a desktop
 * browser, which would make it undevelopable and untestable by anything short
 * of the physical device. It also gives a reader whose Kobo is misdetected a
 * way out that does not involve a firmware string.
 */
export function chooseUi(input: {
  userAgent: string | undefined;
  cookie: string | undefined;
}): UiChoice {
  if (input.cookie === "lite" || input.cookie === "full") {
    return { ui: input.cookie, reason: "cookie" };
  }

  if (isKoboUserAgent(input.userAgent)) {
    return { ui: "lite", reason: "user-agent" };
  }

  return { ui: "full", reason: "default" };
}
