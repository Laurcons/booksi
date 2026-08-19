import { type Locale } from "@bookcsi/shared";

/**
 * The Kobo interface is Romanian, and says so in one place.
 *
 * §D44 gave the web app two languages and deliberately left this workspace out
 * of that scope for now. The pin is a constant rather than a literal repeated at
 * each call site so that the *decision* is what the reader finds — "not yet",
 * with somewhere to look for why — instead of eight unexplained `"ro"`s that
 * could equally be oversights.
 *
 * What it will take, when the time comes: this file grows a resolver
 * (`resolveLocale` off the session and `Accept-Language` is already shared), the
 * ~78 Romanian strings in `routes/` and `lib/` move into catalogs, and the date
 * input's `AAAA-LL-ZZ` label follows the language. Nothing in `shared/` has to
 * change — that is the part §D44 already paid for.
 */
export const KOBO_LOCALE: Locale = "ro";
