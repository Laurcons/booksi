import { Router } from "express";
import type { Env } from "../config/env";
import { deleteBook, getBook } from "../lib/backend-client";
import { html } from "../lib/html";
import { renderPage } from "../lib/page";
import { requireSession, sessionCookieFrom } from "../lib/require-session";
import { handleBackendError } from "../lib/route-errors";
import { touchGap } from "../lib/tokens";
import { webPx } from "../lib/units";

/**
 * S1.3's delete, and §Dialoguri's rule for it named directly: "Confirmarea
 * ștergerii e pagină întreagă cu două butoane distanțate — cu atingere
 * imprecisă, «Anulează» și «Șterge» nu stau alături." Stacked, not
 * side-by-side, with real vertical space between them.
 */

const EXTRA_STYLE = `
  .confirm-actions a, .confirm-actions button { display: block; margin: 0 0 ${webPx(24) + touchGap}px 0; }
`;

function errorPage(backLink: string): string {
  return renderPage({
    title: "Bookcsi — eroare",
    activeNav: "Cărți",
    body: html`<h1>Ceva n-a mers bine</h1>
      <p><a href="${backLink}">Înapoi</a></p>`,
  });
}

export function createBookDeleteRouter(env: Env): Router {
  const router = Router();
  router.use(requireSession);

  router.get("/books/:id/delete", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const id = req.params["id"]!;

    try {
      const book = await getBook(env, req.headers["user-agent"], session, id);

      res.type("html").send(
        renderPage({
          title: "Bookcsi — șterge cartea",
          activeNav: "Cărți",
          extraStyle: EXTRA_STYLE,
          body: html`<h1>Ștergi „${book.title}”?</h1>
            <p>Definitiv — nu se poate anula.</p>
            <div class="confirm-actions">
              <a class="btn" href="/books/${book.id}">Anulează</a>
              <form method="post" action="/books/${book.id}/delete">
                <button type="submit" class="btn">Șterge</button>
              </form>
            </div>`,
        }),
      );
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(errorPage("/books"));
    }
  });

  router.post("/books/:id/delete", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const id = req.params["id"]!;

    try {
      await deleteBook(env, req.headers["user-agent"], session, id);
      res.redirect(303, "/books");
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(errorPage(`/books/${id}`));
    }
  });

  return router;
}
