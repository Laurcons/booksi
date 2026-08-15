import { Router } from "express";
import {
  GENRE_LABEL,
  GENRE_VALUES,
  STATUS_LABEL,
  STATUS_VALUES,
  type Book,
} from "@bookcsi/shared";
import type { Env } from "../config/env";
import {
  BackendRequestError,
  createBook,
  getBook,
  purchaseBook,
  updateBook,
} from "../lib/backend-client";
import {
  buildBookPayload,
  buildUpdatePayload,
  EMPTY_FORM_VALUES,
  groupErrorsByField,
  readFormValues,
  valuesFromBook,
  type BookFormValues,
} from "../lib/book-form-fields";
import { html, raw, type Html } from "../lib/html";
import { renderPage } from "../lib/page";
import { requireSession, sessionCookieFrom } from "../lib/require-session";
import { handleBackendError } from "../lib/route-errors";
import { bodyFont, fontSize, ink, ruleWidth, touchGap, touchMin } from "../lib/tokens";
import { webPx } from "../lib/units";
import { BOOK_FORM_SCRIPT } from "./book-form-script";

/**
 * S1.1 (add) and S1.3/S1.4/S2.1–S2.4 (edit, which is also every status
 * transition and every progress/rating/price update — §D12: no state
 * machine, any field editable any time). Manual entry only for this pass —
 * no Open Library search exists on this surface.
 *
 * One form renders both pages. `/books/new` starts it empty; `/books/{id}`
 * starts it from `valuesFromBook`. Submission is where they differ:
 * `POST /books/new` sends everything `createBook` accepts, `POST /books/{id}`
 * diffs against the book as it was fetched and sends only what changed —
 * `buildUpdatePayload`'s doc comment says why that diff has to happen here,
 * not just as a courtesy to the API.
 */

const EXTRA_STYLE = `
  /* §Componente: the title is user data here too (the edit page's own
     heading), so it gets the same two-line ceiling as a book row's title. */
  h1 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .field-error { display: block; font-weight: bold; font-size: ${fontSize.meta}px; margin: 0 0 ${webPx(2)}px 0; }
  label { display: block; margin: 0 0 ${webPx(16)}px 0; }
  input[type="text"], select {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: ${touchMin}px;
    margin-top: ${webPx(4)}px;
    padding: ${webPx(8)}px;
    border: ${ruleWidth}px solid ${ink.primary};
    font-family: ${bodyFont};
    font-size: ${fontSize.body}px;
    background: #fff;
  }
  /* Sectioning is a no-op without JS — see book-form-script.ts. Every rule
     below only ever matters once the script has actually run. */
  .wizard-hidden { display: none; }
  .wizard-nav { margin: 0 0 ${webPx(16)}px 0; }
  .wizard-step { display: inline-block; margin: 0 ${touchGap}px; font-size: ${fontSize.body}px; }
`;

const GENRE_OPTIONS: [string, string][] = [
  ["", "— fără categorie —"],
  ...GENRE_VALUES.map((g): [string, string] => [g, GENRE_LABEL[g]]),
];

const STATUS_OPTIONS: [string, string][] = STATUS_VALUES.map(
  (s): [string, string] => [s, STATUS_LABEL[s]],
);

const RATING_OPTIONS: [string, string][] = [
  ["", "— fără rating —"],
  ...[1, 2, 3, 4, 5].map((n): [string, string] => [String(n), `${n}/5`]),
];

function textField(
  name: keyof BookFormValues,
  label: string,
  values: BookFormValues,
  errors: Record<string, string[]>,
  numeric = false,
): Html {
  return html`<p>
    ${(errors[name] ?? []).map((msg) => html`<span class="field-error">${msg}</span>`)}
    <label
      >${label}
      <input
        type="text"
        name="${name}"
        value="${values[name]}"
        inputmode="${numeric ? "decimal" : "text"}"
    /></label>
  </p>`;
}

function selectField(
  name: keyof BookFormValues,
  label: string,
  options: readonly [string, string][],
  values: BookFormValues,
  errors: Record<string, string[]>,
): Html {
  return html`<p>
    ${(errors[name] ?? []).map((msg) => html`<span class="field-error">${msg}</span>`)}
    <label
      >${label}
      <select name="${name}">
        ${options.map(
          ([value, optionLabel]) =>
            html`<option value="${value}" ${value === values[name] ? raw("selected") : null}
              >${optionLabel}</option
            >`,
        )}
      </select></label
    >
  </p>`;
}

/**
 * Three `.wizard-section` groups — enough to make the tap-through worth
 * having, not so many that the last one is a single field. Without
 * `book-form-script.ts` these are just three `<div>`s in normal flow: every
 * field is visible and the page scrolls, exactly as it did before the
 * script existed. The submit button lives in the last one on purpose — it
 * is the only field this page truly needs sectioning to gate.
 */
function formFields(values: BookFormValues, errors: Record<string, string[]>): Html {
  return html`${(errors[""] ?? []).map((msg) => html`<p class="field-error">${msg}</p>`)}
    <div class="wizard-section">
      ${textField("title", "Titlu", values, errors)}
      ${textField("author", "Autor", values, errors)}
      ${textField("isbn", "ISBN", values, errors)}
      ${textField("totalPages", "Număr de pagini", values, errors, true)}
      ${selectField("genre", "Categorie", GENRE_OPTIONS, values, errors)}
      ${textField("publisher", "Editura", values, errors)}
      ${textField("publicationYear", "Anul apariției", values, errors, true)}
      ${textField("volume", "Volum", values, errors, true)}
      ${textField("format", "Format", values, errors)}
    </div>
    <div class="wizard-section">
      ${selectField("status", "Status", STATUS_OPTIONS, values, errors)}
      ${textField("pagesRead", "Pagini citite", values, errors, true)}
      ${selectField("rating", "Rating", RATING_OPTIONS, values, errors)}
    </div>
    <div class="wizard-section">
      ${textField("estimatedPrice", "Preț estimat (lei)", values, errors, true)}
      ${textField("paidPrice", "Preț plătit (lei)", values, errors, true)}
      ${textField("purchasedOn", "Data cumpărării (AAAA-LL-ZZ)", values, errors)}
      ${textField("startedOn", "Data începerii (AAAA-LL-ZZ)", values, errors)}
      ${textField("finishedOn", "Data terminării (AAAA-LL-ZZ)", values, errors)}
      <button type="submit" class="btn btn-primary">Salvează</button>
    </div>`;
}

function renderAddPage(values: BookFormValues, errors: Record<string, string[]>): string {
  return renderPage({
    title: "Bookcsi — carte nouă",
    activeNav: "Cărți",
    extraStyle: EXTRA_STYLE,
    body: html`<h1>Carte nouă</h1>
      <form method="post" action="/books/new">${formFields(values, errors)}</form>
      <p><a href="/books">‹ Înapoi la listă</a></p>
      <script>
        ${raw(BOOK_FORM_SCRIPT)}
      </script>`,
  });
}

function renderEditPage(
  book: Book,
  values: BookFormValues,
  errors: Record<string, string[]>,
): string {
  return renderPage({
    title: `Bookcsi — ${book.title}`,
    activeNav: "Cărți",
    extraStyle: EXTRA_STYLE,
    body: html`<h1>${book.title}</h1>
      <form method="post" action="/books/${book.id}">${formFields(values, errors)}</form>
      <!-- book-form-script.ts queries .wizard-section document-wide, not
           scoped to the form above — so this section is picked up as a
           fourth step and gated behind the same Next/Back nav as the other
           three. Measured, not assumed: left ungated, the purchase button,
           delete link, and back link always rendered alongside step 1 and
           pushed the page past the panel's 1264px on a WISHLIST book with a
           long title (docs/kobo_design.md §Mediu constraint 5). -->
      <div class="wizard-section">
        ${book.status === "WISHLIST"
          ? html`<form method="post" action="/books/${book.id}/purchase">
              <button type="submit" class="btn btn-primary">Marchează drept cumpărată</button>
            </form>`
          : null}
        <p><a class="btn" href="/books/${book.id}/delete">Șterge cartea</a></p>
        <p><a href="/books">‹ Înapoi la listă</a></p>
      </div>
      <script>
        ${raw(BOOK_FORM_SCRIPT)}
      </script>`,
  });
}

function genericErrorPage(): string {
  return renderPage({
    title: "Bookcsi — eroare",
    activeNav: "Cărți",
    body: html`<h1>Ceva n-a mers bine</h1>
      <p><a href="/books">Înapoi la listă</a></p>`,
  });
}

export function createBookFormRouter(env: Env): Router {
  const router = Router();
  router.use(requireSession);

  router.get("/books/new", (_req, res) => {
    res.type("html").send(renderAddPage(EMPTY_FORM_VALUES, {}));
  });

  router.post("/books/new", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const values = readFormValues(req.body);

    try {
      const book = await createBook(env, req.headers["user-agent"], session, buildBookPayload(values));
      res.redirect(303, `/books/${book.id}`);
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      if (error instanceof BackendRequestError) {
        res.type("html").send(renderAddPage(values, groupErrorsByField(error.messages)));
        return;
      }
      res.type("html").send(genericErrorPage());
    }
  });

  // Declared after `/books/new` on purpose: Express matches in registration
  // order, and `:id` would otherwise swallow "new" as an id.
  router.get("/books/:id", async (req, res) => {
    const session = sessionCookieFrom(req)!;

    try {
      const book = await getBook(env, req.headers["user-agent"], session, req.params["id"]!);
      res.type("html").send(renderEditPage(book, valuesFromBook(book), {}));
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(genericErrorPage());
    }
  });

  router.post("/books/:id", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const userAgent = req.headers["user-agent"];
    const id = req.params["id"]!;
    let original: Book;

    try {
      original = await getBook(env, userAgent, session, id);
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(genericErrorPage());
      return;
    }

    const values = readFormValues(req.body);

    try {
      const updated = await updateBook(env, userAgent, session, id, buildUpdatePayload(values, original));
      res.redirect(303, `/books/${updated.id}`);
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      if (error instanceof BackendRequestError) {
        res
          .type("html")
          .send(renderEditPage(original, values, groupErrorsByField(error.messages)));
        return;
      }
      res.type("html").send(genericErrorPage());
    }
  });

  router.post("/books/:id/purchase", async (req, res) => {
    const session = sessionCookieFrom(req)!;

    try {
      const book = await purchaseBook(env, req.headers["user-agent"], session, req.params["id"]!);
      res.redirect(303, `/books/${book.id}`);
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.type("html").send(genericErrorPage());
    }
  });

  return router;
}
