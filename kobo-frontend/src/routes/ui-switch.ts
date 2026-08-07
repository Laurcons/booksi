import { Router } from "express";
import { UI_COOKIE } from "../lib/ui-choice";

/**
 * The escape hatch that makes User-Agent routing workable.
 *
 * Routing on User-Agent alone means the lite interface is reachable only from
 * the one device that produces the right string — you could not open it from a
 * laptop to develop it, and a reader whose Kobo went undetected would have no
 * way to ask for it. These three routes set a cookie the proxy checks *before*
 * it looks at the User-Agent.
 *
 * The proxy sends `/ui/*` here unconditionally, whichever interface it would
 * otherwise pick, so that `/ui/full` still works from a device that is
 * currently pinned to lite.
 */
export const uiSwitchRouter: Router = Router();

/** A year: the point is that the choice outlives the session it was made in. */
const PIN_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Only same-origin paths. `next` comes from the query string, so without this
 * check the switch is an open redirect — `/ui/lite?next=https://elsewhere` would
 * bounce the reader off the site with a fresh cookie set. A leading `//` is
 * rejected along with absolute URLs because browsers read it as scheme-relative.
 */
function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/probe";
  }

  return next;
}

uiSwitchRouter.get("/ui/:choice", (req, res) => {
  const choice = req.params.choice;
  const next = safeNext(req.query["next"]);

  if (choice === "lite" || choice === "full") {
    // Not httpOnly on purpose, unlike the session cookie (§D20): this one
    // carries no authority, and being readable from the page is useful for
    // debugging. `Lax` so it survives the redirect below.
    res.cookie(UI_COOKIE, choice, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: PIN_MAX_AGE_MS,
    });

    res.redirect(302, next);
    return;
  }

  if (choice === "auto") {
    res.clearCookie(UI_COOKIE, { path: "/" });
    res.redirect(302, next);
    return;
  }

  res
    .status(404)
    .type("text/plain; charset=utf-8")
    .send("Alegerile posibile sunt: lite, full, auto.");
});
