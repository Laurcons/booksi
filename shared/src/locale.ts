import { z } from "zod";

/**
 * The two languages the interface speaks, and how a request is matched to one
 * (§D44, amending §D21).
 *
 * §D21 promised that a second language would cost only the label maps. That
 * turned out to be true of `STATUS_LABEL` and `GENRE_LABEL` and false of
 * everything else — the validation messages in `book.ts` were Romanian too,
 * and so were two hundred strings of JSX. This module is the part of the
 * correction that both ends share: *which* language, decided the same way on
 * the client and on the server.
 */

export const LOCALES = ["ro", "en"] as const;

export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

/**
 * The answer when nothing better is known: no session to read a preference
 * from, and no recognisable language on the request.
 *
 * English rather than Romanian, even though every account that exists today is
 * Romanian. Those accounts carry `locale` on their row and never reach this
 * constant — it is only consulted for a stranger, and a stranger whose device
 * asks for neither of our languages is better served by the more widely read
 * one.
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * A BCP 47 tag reduced to the part we match on: `ro-RO` → `ro`, `EN-gb` → `en`.
 *
 * Language ranges match by prefix (RFC 4647 "basic filtering"), and we offer
 * no regional variants, so the primary subtag is the whole comparison.
 */
function primarySubtag(tag: string): string {
  return tag.trim().split("-")[0]!.toLowerCase();
}

/**
 * The first supported language in an ordered list of preferences, or
 * `DEFAULT_LOCALE`.
 *
 * **First match wins, and the list's order is obeyed.** The tempting
 * alternative — scan the whole list and prefer `ro` wherever it appears — was
 * considered and rejected: a device set to English with Romanian further down
 * has expressed a preference, and overriding it is not negotiation. It also
 * desynchronises the two ends, because Safari trims `Accept-Language` for
 * fingerprinting reasons while `navigator.languages` keeps the full list — so
 * a whole-list scan could find `ro` in the browser and not in the header, and
 * put one language on screen and another in the error text on the same page.
 *
 * Shared by both callers for exactly that reason: the client passes
 * `navigator.languages`, the server passes `parseAcceptLanguage(...)`, and they
 * agree because it is the same function over the same underlying setting.
 */
export function matchLocale(preferences: readonly string[]): Locale {
  for (const tag of preferences) {
    const subtag = primarySubtag(tag);
    const hit = LOCALES.find((locale) => locale === subtag);

    if (hit) {
      return hit;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * `Accept-Language` as an ordered list of tags, most wanted first.
 *
 * The header is not a list in preference order — it is a *weighted* list, and
 * the weight is what ranks it. `en;q=0.5,ro;q=0.9` asks for Romanian despite
 * reading English-first, so sorting by `q` is not a refinement of document
 * order but a correction of it. Ties keep document order, which `Array#sort`
 * guarantees.
 *
 * Two shapes are dropped rather than ranked:
 *
 * - `q=0` means "explicitly not acceptable" — the one case where naming a
 *   language is a request *not* to receive it.
 * - `*` means "anything else", which cannot name a language and so cannot win
 *   a first-match search. Letting it fall through to `DEFAULT_LOCALE` is the
 *   same answer by a shorter route.
 */
export function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) {
    return [];
  }

  return header
    .split(",")
    .flatMap((part) => {
      const [tag = "", ...params] = part.split(";");
      const name = tag.trim();

      if (name === "" || name === "*") {
        return [];
      }

      const quality = params
        .map((param) => /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param))
        .find((match) => match !== null);

      // An absent or unparseable `q` is 1 — the spec's default, and the
      // overwhelmingly common case, since browsers omit it on the first entry.
      const q = quality ? Number.parseFloat(quality[1]!) : 1;

      if (!Number.isFinite(q) || q <= 0) {
        return [];
      }

      return [{ name, q }];
    })
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.name);
}

/**
 * The server's whole decision, in one place: the signed-in user's stored
 * preference, else what the request's own header asks for.
 *
 * The row wins outright when there is one. A user who chose Romanian on a
 * borrowed English laptop chose Romanian, and the header is not a second vote.
 */
export function resolveLocale(
  stored: Locale | null | undefined,
  acceptLanguage: string | undefined,
): Locale {
  return stored ?? matchLocale(parseAcceptLanguage(acceptLanguage));
}
