import { Router } from "express";
import {
  CURRENCY,
  formatCount,
  formatMoney,
  GENRE_LABEL,
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
import {
  bodyFont,
  coverHeight,
  coverRadius,
  coverWidth,
  displayFont,
  fontSize,
  ink,
  ruleWidth,
} from "../lib/tokens";
import { webPx } from "../lib/units";

/**
 * S1.2 as fișe, not a table (§Componente/Lista de cărți). S8.1's dashboard
 * sits beside the heading, not below it — a second inline-block column, not
 * a second page: `.header-dashboard`'s height (two rows of small figures)
 * is close to, but still less than, `.header-main`'s (heading + button), so
 * it rides along for nearly free instead of adding a band the row budget
 * has to pay for outright. The full-size dashboard tried that band first
 * and cost the page ~370px; a page of its own tried next and worked but
 * cost a tap to reach the numbers a reader used to see on open. Shrinking
 * the figures in place and running them next to the header, not above it,
 * is what made both of those unnecessary — see `pagination.ts` for exactly
 * how much of the row budget this still spends.
 */

/**
 * This page's own type scale runs at 0.75× §Scara's sizes, not the global
 * one — §Scara's numbers were set for a page with one thing on it at a time;
 * once the header carries a heading, a button, and four figures side by
 * side, and a row carries a title and a full metadata line, the full-size
 * scale left too little room to fit more than a couple of rows. Floored at
 * `fontSize.floor` (9pt/19px, §Scara's own "nimic sub asta nu se pune pe
 * pagină") rather than let a role cross it: `book-meta`/`book-status`/
 * `book-progress` and `figure-label` would land at ~16px on a literal 0.75×,
 * which the design document rules out outright, not just discourages.
 */
const PAGE_SCALE = 0.75;
function scaled(px: number): number {
  return Math.max(fontSize.floor, Math.round(px * PAGE_SCALE));
}

// Row spacing tightened from the original §Componente mockup values after
// the no-scroll harness measured a fișă at ~308px tall against a ~758px
// chrome cost — five of them (the original BOOKS_PER_PAGE) never fit
// alongside the panel's own nav, heading, and pager, dashboard or not. The
// cover stays at 15×22mm (§Componente/Coperți already reasons up to that
// size from a too-small first draft, unrelated to this budget), so the cut
// comes from the margins around it and from using the row's plentiful width:
// author/year, state/rating, and reading progress are one metadata line below
// the (at-most-two-line) title, rather than three narrow stacked lines. Not a
// `<table>`: title and author are still meant to read as one unit, one under
// the other, the way a byline sits under a headline — only the *rest* of the
// metadata moves onto that second line instead of getting a line each.
const EXTRA_STYLE = `
  .header-main { display: inline-block; vertical-align: top; width: 52%; }
  .header-main h1 { font-size: ${scaled(fontSize.pageTitle)}px; margin: 0 0 ${webPx(8)}px 0; }
  .header-main p { margin: 0; }
  .header-dashboard { display: inline-block; vertical-align: top; width: 40%; margin-left: 3%; }
  .figure { display: inline-block; width: 48%; vertical-align: top; margin: 0; }
  .figure-value { font-family: ${displayFont}; font-weight: bold; font-size: ${scaled(fontSize.sectionTitle)}px; margin: 0; }
  .figure-label { font-family: ${bodyFont}; font-size: ${scaled(fontSize.meta)}px; color: ${ink.secondary}; margin: 0; }
  /* Two per row, not one full-width — box-sizing: border-box because a card
     has no border of its own but everything inside it is budgeted against
     its width, same reasoning as .cover below. 48%+48% leaves 4% real slack
     for the row gap, deliberately not summed to exactly 100% — see
     pagination.ts and today's two inline-block wrapping bugs for why a card
     pair that leaves no slack is a bug waiting to reappear. nth-child drops
     the gutter on the second card of each row so the grid stays flush on
     both edges. */
  .book-card {
    display: inline-block;
    vertical-align: top;
    box-sizing: border-box;
    width: 48%;
    margin: 0 4% ${webPx(9)}px 0;
  }
  .book-card:nth-child(2n) { margin-right: 0; }
  /* box-sizing: border-box so the border sits inside the declared 89×130 —
     without it the rendered box is 4px wider than .book-info's width calc
     assumes, which was enough on its own to wrap the row (see bookRow()'s
     comment on the array-join fix for the other half of that bug). */
  .cover {
    box-sizing: border-box;
    border: ${ruleWidth}px solid ${ink.primary};
    border-radius: ${coverRadius}px;
    vertical-align: top;
  }
  /* §Coperți's placeholder: a drawn cover, not a broken-image icon — a black
     rule and a serif title, no inner accent border the way the React app's
     version has one (a "brass" rule at 96ppi grayscales into a stray line
     here, not a frame). \`table-cell\` centers title/author rather than flex:
     flex support on this engine is exactly what \`/probe\` is still checking
     (\`probe.ts\`), so nothing else on this page commits to it yet. */
  .cover-placeholder {
    display: inline-table;
    box-sizing: border-box;
    width: ${coverWidth}px;
    height: ${coverHeight}px;
    border: ${ruleWidth}px solid ${ink.primary};
    border-radius: ${coverRadius}px;
    vertical-align: top;
    overflow: hidden;
  }
  .cover-placeholder-cell {
    display: table-cell;
    vertical-align: middle;
    text-align: center;
    padding: 0 ${webPx(4)}px;
  }
  .cover-placeholder-title, .cover-placeholder-author {
    display: block;
    font-family: ${displayFont};
    font-size: ${scaled(fontSize.meta)}px;
    line-height: 1.15;
  }
  .cover-placeholder-title { font-weight: bold; }
  .cover-placeholder-author { color: ${ink.secondary}; margin-top: ${webPx(4)}px; }
  .book-info { display: inline-block; vertical-align: top; width: calc(100% - ${coverWidth + webPx(16)}px); margin-left: ${webPx(16)}px; }
  /* Single line, ellipsis — not the two-line clamp the wide layout used.
     A narrower card makes wrapping cheap to trigger and expensive to allow:
     two cards side by side with different title-wrap heights leave a ragged
     gap under the shorter one, since inline-block has no way to equalise
     row heights the way grid would. Truncating instead keeps every card the
     same height, at the cost some real titles will end in an ellipsis. */
  .book-title {
    font-size: ${scaled(fontSize.body)}px;
    font-weight: bold;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .book-details { margin: 0 0 ${webPx(2)}px 0; font-size: ${scaled(fontSize.meta)}px; white-space: nowrap; overflow: hidden; }
  .book-meta, .book-status, .book-extra, .book-progress {
    display: inline-block;
    vertical-align: middle;
    margin: 0 ${webPx(12)}px 0 0;
  }
  /* Same truncation as the title, same reason — the author is the one
     metadata field with no fixed shape, so it is the one that needs its own
     ellipsis rather than relying on .book-details' overflow: hidden to just
     cut the whole line off wherever it runs out of room. */
  .book-meta {
    max-width: 55%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .book-meta, .book-extra { color: ${ink.secondary}; }
  .book-progress { margin-right: 0; }
  .pager-label { font-size: ${scaled(fontSize.meta)}px; }
`;

function dashboard(stats: StatsOverview, budget: BudgetSummary): Html {
  const figures: [string, string][] = [
    [formatCount(stats.booksFinished), "Cărți citite"],
    [formatCount(stats.booksReading), "În curs"],
    [formatCount(stats.pagesRead), "Pagini citite"],
    [`${formatMoney(budget.month.spent)} ${CURRENCY}`, "Cheltuit luna asta"],
  ];

  return html`<div class="header-dashboard">
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

/**
 * Genre, then price, then either the reading progress or the page count —
 * whichever of the last two actually says something `progressLabel()`
 * doesn't already cover. Wishlist price is an estimate (`~`, §D6 keeps it a
 * separate field from what was actually paid); every other status shows
 * what was paid, when there is one — a book typed straight in as `Terminat`
 * has no obligation to carry a price at all.
 */
function bookExtras(book: Book): Html[] {
  const extras: Html[] = [];

  if (book.genre !== null) {
    extras.push(html`<span class="book-extra">${GENRE_LABEL[book.genre]}</span>`);
  }

  const price = book.status === "WISHLIST" ? book.estimatedPrice : book.paidPrice;
  if (price !== null) {
    const prefix = book.status === "WISHLIST" ? "~" : "";
    extras.push(html`<span class="book-extra">${prefix}${formatMoney(price)} ${CURRENCY}</span>`);
  }

  if (showsProgressBar(book)) {
    extras.push(html`<span class="book-progress">${progressLabel(book)}</span>`);
  } else if (book.totalPages !== null) {
    extras.push(html`<span class="book-extra">${formatCount(book.totalPages)} pagini</span>`);
  }

  return extras;
}

/**
 * Split into two `Html` values interpolated as one array (`${[cover, info]}`)
 * rather than written as adjacent template literals: `html`'s `stringify`
 * joins an array with `""`, no separator, while two sibling tags in the same
 * template carry the newline and indentation between them into the output as
 * a literal space. That space is real content to an `inline-block` layout —
 * combined with `.cover`'s border (fixed by `box-sizing: border-box` above),
 * it was enough on its own to push `.book-info` onto its own line below the
 * cover instead of beside it, on every engine, not just this one.
 */
function bookRow(book: Book): Html {
  const cover =
    book.coverUrl === null
      ? html`<span class="cover-placeholder" aria-hidden="true">
          <span class="cover-placeholder-cell">
            <span class="cover-placeholder-title">${book.title}</span>
            <span class="cover-placeholder-author">${book.author ?? "Autor necunoscut"}</span>
          </span>
        </span>`
      : html`<img
          class="cover"
          src="${book.coverUrl}"
          width="${coverWidth}"
          height="${coverHeight}"
          alt=""
        />`;

  const extras = bookExtras(book);

  const info = html`<div class="book-info">
    <a class="book-title" href="/books/${book.id}">${book.title}</a>
    <p class="book-details">
      <span class="book-meta">${book.author ?? "Autor necunoscut"} · ${addedYear(book)}</span>
      <span class="book-status">
        ${statusPill(book.status)}${book.rating !== null ? html` ${ratingLabel(book.rating)}` : null}
      </span>
    </p>
    ${extras.length > 0 ? html`<p class="book-details">${extras}</p>` : null}
  </div>`;

  return html`<div class="book-card">${[cover, info]}</div>`;
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

  return html`<p>${prev} <span class="pager-label">pagina ${page} din ${totalPages}</span> ${next}</p>`;
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

      // header-main and dashboardHtml are interpolated as one array, not as
      // adjacent template literals — same reason as bookRow()'s cover/info
      // split: the whitespace between two sibling tags in one template
      // becomes a real space in the output, which is what was wrapping this
      // header onto two rows instead of two columns.
      const headerMain = html`<div class="header-main">
        <h1>Cărți</h1>
        <p><a class="btn btn-primary" href="/books/new">Adaugă o carte</a></p>
      </div>`;

      res.type("html").send(
        renderPage({
          title: "Bookcsi — cărți",
          activeNav: "Cărți",
          extraStyle: EXTRA_STYLE,
          body: html`${[headerMain, dashboardHtml]}
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
