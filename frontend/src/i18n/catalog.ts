import { translator, type Catalog, type Locale, type Vars } from "@bookcsi/shared";
import { en } from "./en";
import { ro, type MessageKey } from "./ro";

/**
 * The UI catalogs, by language (§D44).
 *
 * Separate from `shared/`'s catalogs on purpose: validation messages and error
 * sentences live there because *both* ends render them, while this is screen
 * copy that only the web app has. Putting it in `shared/` would ship the whole
 * interface's text to the API and to the Kobo server, neither of which reads a
 * word of it.
 */
export const catalogs: Record<Locale, Catalog<MessageKey>> = { ro, en };

export type { MessageKey };

/**
 * The bound `t` that `useT()` returns, named so plain modules can take one.
 *
 * `month.ts` and `wishlist-coverage.ts` render text without being components —
 * they are called from a chart axis and from a summary line — so they receive
 * the translator rather than reaching for a hook they cannot use.
 */
export type TFunction = (key: MessageKey, vars?: Vars) => string;

/**
 * A translator for one language, built from the real catalogs.
 *
 * For the callers that render text without being components — and for their
 * tests, which are then asserting against the words that actually ship rather
 * than against a stub that could drift from them.
 */
export function translatorFor(locale: Locale): TFunction {
  return translator(locale, catalogs[locale]);
}

/**
 * Whether a string is a key this catalog knows.
 *
 * For the values that arrive from outside the type system — `history.state`
 * survives reloads and is editable from the console — where a wrong key would
 * otherwise render as itself.
 */
export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === "string" && value in ro;
}
