import type { Request } from "express";
import { type AuthUser, type Locale, resolveLocale } from "@bookcsi/shared";

/**
 * Which language to answer this request in (§D44).
 *
 * **A pure function of the request, with no request-scoped machinery behind
 * it.** That is worth spelling out, because the obvious readings of this problem
 * both lead somewhere heavier. A locale that depends on the signed-in user looks
 * like it needs either an `AsyncLocalStorage` context or a request-scoped
 * provider to reach a validator buried three frames down — and it needs
 * neither, because Nest has already put the answer on the request by the time
 * anything asks. Guards run before pipes, parameter decorators and handlers, so
 * `JwtStrategy` has attached `req.user` before any of them can call this; and
 * the exception filter is handed the same request afterwards. The request *is*
 * the context.
 *
 * The precedence is `resolveLocale`'s and is shared with the client: the stored
 * preference wins outright, and `Accept-Language` only decides for a request
 * with nobody behind it — a login, a 401, a rate-limited public route.
 */
export function localeOf(req: Request): Locale {
  // `req.user` is Passport's, typed `Express.User`; every strategy in this app
  // returns an `AuthUser`. Absent on the public routes, which is the case the
  // header exists to answer.
  const user = req.user as AuthUser | undefined;

  return resolveLocale(user?.locale, req.headers["accept-language"]);
}
