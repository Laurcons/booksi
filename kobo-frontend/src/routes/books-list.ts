import { Router } from "express";
import {
  CURRENCY,
  formatCount,
  formatMoney,
  progressLabel,
  showsProgressBar,
  type Book,
  type BudgetSummary,
  type StatsOverview,
} from "@bookcsi/shared";
import type { Env } from "../config/env";
import { getBudgetSummary, getStatsOverview, listBooks } from "../lib/backend-client";
import { html, type Html } from "../lib/html";
import { BOOKS_PER_PAGE, paginate } from "../lib/pagination";
import { renderPage } from "../lib/page";
import { ratingLabel } from "../lib/rating";
import { requireSession, sessionCookieFrom } from "../lib/require-session";
import { handleBackendError } from "../lib/route-errors";
import { statusPill } from "../lib/status-style";
import { bodyFont, coverHeight, coverRadius, coverWidth, displayFont, fontSize, ink, ruleWidth } from "../lib/tokens";
import { webPx } from "../lib/units";

/**
 * S1.2 as fișe, not a table (§Componente/Lista de cărți) — and S8.1's four
 * dashboard figures above it, the same two endpoints the React dashboard
 * reads (`/stats/overview`, `/budget/summary`), so the numbers agree with
 * every other screen by construction.
 */

const EXTRA_STYLE = `
  .dashboard { margin: 0 0 ${webPx(8)}px 0; }
  .figure { display: inline-block; width: 48%; vertical-align: top; margin: 0 0 ${webPx(20)}px 0; }
  .figure-value { font-family: ${displayFont}; font-size: ${fontSize.hero}px; margin: 0; }
  .figure-label { font-family: ${bodyFont}; font-size: ${fontSize.meta}px; color: ${ink.secondary}; margin: 0; }
  .book-row { margin: 0 0 ${webPx(20)}px 0; }
  .cover { border: ${ruleWidth}px solid ${ink.primary}; border-radius: ${coverRadius}px; vertical-align: top; }
  .book-info { display: inline-block; vertical-align: top; width: calc(100% - ${coverWidth + webPx(16)}px); margin-left: ${webPx(16)}px; }
  .book-title { font-size: ${fontSize.body}px; font-weight: bold; }
  .book-meta { font-size: ${fontSize.meta}px; color: ${ink.secondary}; margin: ${webPx(4)}px 0; }
  .book-status { margin: ${webPx(4)}px 0; }
  .book-progress { font-size: ${fontSize.meta}px; margin: ${webPx(4)}px 0; }
`;

function dashboard(stats: StatsOverview, budget: BudgetSummary): Html {
  const figures: [string, string][] = [
    [formatCount(stats.booksFinished), "Cărți citite"],
    [formatCount(stats.booksReading), "În curs"],
    [formatCount(stats.pagesRead), "Pagini citite"],
    [`${formatMoney(budget.month.spent)} ${CURRENCY}`, "Cheltuit luna asta"],
  ];

  return html`<div class="dashboard">
    ${figures.map(
      ([value, label]) =>
        html`<div class="figure">
          <p class="figure-value">${value}</p>
          <p class="figure-label">${label}</p>
        </div>`,
    )}
  </div>`;
}

/** The one interpretation the mockup's "Autorul · 2024" needed: the year a book entered the library — the only date every row has. */
function addedYear(book: Book): number {
  return new Date(book.createdAt).getFullYear();
}

function bookRow(book: Book): Html {
  return html`<div class="book-row">
    <img
      class="cover"
      src="${book.coverUrl ?? ""}"
      width="${coverWidth}"
      height="${coverHeight}"
      alt=""
    />
    <div class="book-info">
      <a class="book-title" href="/books/${book.id}">${book.title}</a>
      <p class="book-meta">${book.author ?? "Autor necunoscut"} · ${addedYear(book)}</p>
      <p class="book-status">
        ${statusPill(book.status)}${book.rating !== null ? html` ${ratingLabel(book.rating)}` : null}
      </p>
      ${showsProgressBar(book)
        ? html`<p class="book-progress">${progressLabel(book)}</p>`
        : null}
    </div>
  </div>`;
}

function pager(page: number, totalPages: number): Html {
  const prev =
    page > 1
      ? html`<a class="btn" href="/books?page=${page - 1}">‹ Înapoi</a>`
      : html`<span class="btn" aria-disabled="true">‹ Înapoi</span>`;
  const next =
    page < totalPages
      ? html`<a class="btn" href="/books?page=${page + 1}">Înainte ›</a>`
      : html`<span class="btn" aria-disabled="true">Înainte ›</span>`;

  return html`<p>${prev} pagina ${page} din ${totalPages} ${next}</p>`;
}

function errorPage(): string {
  return renderPage({
    title: "Bookcsi — eroare",
    activeNav: "Cărți",
    body: html`<h1>Ceva n-a mers bine</h1>
      <p>Nu am putut încărca biblioteca. <a href="/books">Încearcă din nou</a></p>`,
  });
}

export function createBooksListRouter(env: Env): Router {
  const router = Router();
  router.use(requireSession);

  router.get("/books", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const requestedPage = Number(req.query["page"]);

    try {
      const books = await listBooks(env, session);
      const { items, page, totalPages } = paginate(books, requestedPage, BOOKS_PER_PAGE);

      // The dashboard describes the whole library, not one page of it —
      // repeating it on every page would be the same four numbers shown
      // again for no reason, and skipping the two extra requests behind it
      // is also most of what page 2 onward needs to fit without scrolling.
      let dashboardHtml: Html | null = null;
      if (page === 1) {
        const [stats, budget] = await Promise.all([
          getStatsOverview(env, session),
          getBudgetSummary(env, session),
        ]);
        dashboardHtml = dashboard(stats, budget);
      }

      res.type("html").send(
        renderPage({
          title: "Bookcsi — cărți",
          activeNav: "Cărți",
          extraStyle: EXTRA_STYLE,
          body: html`<h1>Cărți</h1>
            ${dashboardHtml}
            ${dashboardHtml ? html`<hr />` : null}
            <p><a class="btn btn-primary" href="/books/new">Adaugă o carte</a></p>
            ${books.length === 0
              ? html`<p>Biblioteca e goală.</p>`
              : html`${pager(page, totalPages)} ${items.map(bookRow)}
                  ${pager(page, totalPages)}`}`,
        }),
      );
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(errorPage());
    }
  });

  return router;
}
