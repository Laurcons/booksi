import { Router, type CookieOptions } from "express";
import { PAIRING_TTL_MINUTES, type PairingStatusResponse } from "@bookcsi/shared";
import type { Env } from "../config/env";
import { consumePairing, createPairing, pairingStatus } from "../lib/backend-client";
import { html, type Html } from "../lib/html";
import { renderPage } from "../lib/page";
import { bodyFont, fontSize } from "../lib/tokens";
import { SESSION_COOKIE, sessionCookieOptions } from "../lib/session-cookie";

/**
 * §Autentificare (docs/kobo_design.md), §D37's open question closed: a Kobo
 * cannot complete Google's consent screen, so a session reaches it by pairing
 * instead. The Kobo shows a code, a signed-in browser elsewhere types it in
 * and approves (`PairKoboPage.tsx`, `POST /pairing/approve`), and the Kobo
 * turns the same approval into its own session cookie here.
 *
 * No polling: there is no JavaScript on this device to hold one open, and
 * `<meta http-equiv="refresh">` would cost a flash every cycle — an anti-
 * pattern the design document names outright. So the "waiting" state is a
 * page with one link, re-checked only when tapped.
 */

/** Holds the pairing's id between "/pair" and "/pair/continue" — nothing else needs it. */
const PAIRING_COOKIE = "kobo_pairing";

function pairingCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/pair",
    maxAge: PAIRING_TTL_MINUTES * 60_000,
  };
}

function codeSpan(code: string): Html {
  // Two groups of three, per §Autentificare: "the code is read, not
  // deciphered" — a bare six-character run is harder to hold in the eye
  // while looking away to type it.
  const grouped = `${code.slice(0, 3)} ${code.slice(3)}`;

  return html`<p style="font-family: ${bodyFont}; font-size: ${fontSize.hero}px; letter-spacing: 0.15em; margin: 0 0 24px 0;">
    ${grouped}
  </p>`;
}

function pairingPage(code: string): string {
  return renderPage({
    title: "Bookcsi — împerechere",
    body: html`<h1>Împerechere</h1>
      <p>
        Pe alt dispozitiv, într-un cont deja autentificat, deschide „Aplicații
        conectate” și tastează codul de mai jos.
      </p>
      ${codeSpan(code)}
      <p>După ce ai aprobat acolo, apasă mai jos.</p>
      <a class="btn btn-primary" href="/pair/continue">Am aprobat, continuă</a>`,
  });
}

function expiredPage(): string {
  return renderPage({
    title: "Bookcsi — cod expirat",
    body: html`<h1>Codul a expirat</h1>
      <p>Codurile țin zece minute. Ia unul nou și încearcă din nou.</p>
      <a class="btn" href="/pair">Ia un cod nou</a>`,
  });
}

function errorPage(): string {
  return renderPage({
    title: "Bookcsi — eroare",
    body: html`<h1>Ceva n-a mers bine</h1>
      <p>Nu am putut ajunge la server. Încearcă din nou peste puțin.</p>
      <a class="btn" href="/pair">Încearcă din nou</a>`,
  });
}

export function createPairRouter(env: Env): Router {
  const router = Router();

  /**
   * The entry point. A pending or already-approved pairing is shown again
   * rather than replaced — a reload here (a bookmark tapped twice, a stray
   * refresh) must not invalidate a code someone is mid-way through typing
   * on another screen.
   */
  router.get("/pair", async (req, res) => {
    const userAgent = req.headers["user-agent"];
    const existingId = (req.cookies as Record<string, string> | undefined)?.[
      PAIRING_COOKIE
    ];

    if (existingId) {
      const reused = await tryStatus(env, userAgent, existingId);
      if (reused && (reused.status === "pending" || reused.status === "approved")) {
        res.type("html").send(pairingPage(reused.code));
        return;
      }
    }

    try {
      const pairing = await createPairing(env, userAgent);
      res.cookie(PAIRING_COOKIE, pairing.id, pairingCookieOptions());
      res.type("html").send(pairingPage(pairing.code));
    } catch {
      res.type("html").send(errorPage());
    }
  });

  /** Reached by the one link on the pairing page — the only "refresh" this flow has. */
  router.get("/pair/continue", async (req, res) => {
    const userAgent = req.headers["user-agent"];
    const id = (req.cookies as Record<string, string> | undefined)?.[PAIRING_COOKIE];

    if (!id) {
      res.redirect(303, "/pair");
      return;
    }

    try {
      const current = await pairingStatus(env, userAgent, id);

      if (current.status === "pending") {
        res.type("html").send(pairingPage(current.code));
        return;
      }

      if (current.status === "expired") {
        res.clearCookie(PAIRING_COOKIE, { path: "/pair" });
        res.type("html").send(expiredPage());
        return;
      }

      if (current.status === "consumed") {
        // Only reachable by tapping the link twice after success — the
        // cookie is already gone by then, so this is just the same "go on
        // in" as a fresh pairing would give.
        res.clearCookie(PAIRING_COOKIE, { path: "/pair" });
        res.redirect(303, "/");
        return;
      }

      const { token } = await consumePairing(env, userAgent, id);
      res.clearCookie(PAIRING_COOKIE, { path: "/pair" });
      res.cookie(
        SESSION_COOKIE,
        token,
        sessionCookieOptions(env.NODE_ENV === "production"),
      );
      res.redirect(303, "/");
    } catch {
      res.type("html").send(errorPage());
    }
  });

  return router;
}

async function tryStatus(
  env: Env,
  userAgent: string | undefined,
  id: string,
): Promise<PairingStatusResponse | undefined> {
  try {
    return await pairingStatus(env, userAgent, id);
  } catch {
    return undefined;
  }
}
