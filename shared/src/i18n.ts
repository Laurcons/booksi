import { DEFAULT_LOCALE, type Locale } from "./locale.js";

/**
 * The message-catalog primitives (§D44). Catalogs themselves live wherever
 * their strings are read — validation messages here in `shared/` because both
 * the pipe and the form resolver need them, UI copy in `frontend/src/i18n/` —
 * but they are all the same shape and go through the same `translate`.
 */

/**
 * A message whose wording depends on a number.
 *
 * `other` is the only required category, and it is the fallback for every one
 * a locale does not spell out. That is what lets Romanian and English share a
 * type despite disagreeing on how many forms exist: Romanian fills
 * `one`/`few`/`other` (1 carte · 2–19 cărți · 20 de cărți), English fills
 * `one`/`other`, and neither needs to know about the other's categories.
 *
 * The category is chosen by `Intl.PluralRules`, not by hand. Worth stating
 * because the hand-rolled rule this replaces was *correct* — Romanian's
 * `few`/`other` split really does fall at 20, and really does return to `few`
 * at 101 — so the platform is not being trusted here in place of knowledge, it
 * is being used because it already encodes the same knowledge for every locale
 * instead of one. It also disagrees at exactly one value: `n = 0` is `few` in
 * CLDR ("0 cărți"), where the old rule produced "0 de cărți".
 */
export type PluralMessage = { other: string } & Partial<
  Record<Intl.LDMLPluralRule, string>
>;

export type Message = string | PluralMessage;

/**
 * A catalog keyed by a fixed set of message names.
 *
 * The keys come from the Romanian catalog, which every other locale is then
 * typed against — so a message added to one language and forgotten in the
 * other is a compile error rather than a string that reads correctly in
 * testing and appears untranslated in production. That check is the reason the
 * catalogs are plain objects instead of JSON files.
 */
export type Catalog<Key extends string> = Readonly<Record<Key, Message>>;

/**
 * Values substituted into `{placeholder}` slots.
 *
 * Numbers are inserted as written — `String(value)` — and deliberately not
 * run through the grouping formatter. Most interpolated numbers are small
 * enough for it not to matter, and the ones that are not are years:
 * `formatCount(2026)` is "2.026", which is not a year in any locale. A caller
 * that wants grouping passes an already-formatted string.
 */
export type Vars = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * `Intl.PluralRules` instances are not free to construct and the set of
 * locales is closed, so each is built once on first use.
 */
const pluralRules = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);

  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }

  return rules;
}

/**
 * Fill `{name}` slots from `vars`.
 *
 * An unmatched placeholder is left standing rather than blanked. Both are
 * wrong, but "Ai {count} cărți" is recognisably a bug on sight, where "Ai
 * cărți" reads as a sentence someone wrote on purpose.
 */
function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) {
    return template;
  }

  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = vars[name];

    return value === undefined ? whole : String(value);
  });
}

/**
 * Resolve one message: pick a plural form if the message has them, then
 * interpolate.
 *
 * A missing key returns the key itself. It cannot happen through the typed
 * `t()` a component uses — `Catalog<Key>` makes it a compile error — so this
 * only guards the dynamic lookups (a status or category label keyed by an enum
 * value read off an API response), and there the key on screen is both
 * harmless and the most useful thing to see in a bug report.
 */
export function translate<Key extends string>(
  locale: Locale,
  catalog: Catalog<Key>,
  key: Key,
  vars?: Vars,
): string {
  const message: Message | undefined = catalog[key];

  if (message === undefined) {
    return key;
  }

  if (typeof message === "string") {
    return interpolate(message, vars);
  }

  const count = vars?.count;

  // A plural message with nothing to count is a mistake at the call site, not
  // a case to invent a number for: `other` is the form that reads least wrongly
  // with the placeholder still in it.
  const form =
    typeof count === "number"
      ? (message[rulesFor(locale).select(count)] ?? message.other)
      : message.other;

  return interpolate(form, vars);
}

/**
 * Bind a locale and a catalog into the `t(key, vars)` that call sites use.
 *
 * Curried rather than a class or a context read on every call so that the
 * non-React consumers — the validation pipe, the MCP layer, a plain module
 * like `wishlist-coverage.ts` — get the same function the components do.
 */
export function translator<Key extends string>(
  locale: Locale,
  catalog: Catalog<Key>,
): (key: Key, vars?: Vars) => string {
  return (key, vars) => translate(locale, catalog, key, vars);
}

/**
 * Pick a locale's catalog out of a set of them, falling back to the default.
 *
 * Exists so that every catalog pair is looked up the same way instead of each
 * consumer writing its own `locale === "ro" ? ro : en`.
 */
export function catalogFor<Key extends string>(
  catalogs: Readonly<Record<Locale, Catalog<Key>>>,
  locale: Locale,
): Catalog<Key> {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE];
}
