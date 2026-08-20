import express, { type Express } from "express";
import type { Book } from "@bookcsi/shared";
import {
  ALL_BOOKS,
  BUDGET_SUMMARY,
  EDIT_PAGE_BOOK,
  FIXTURE_PAIRING_CODE,
  FIXTURE_PAIRING_ID,
  FIXTURE_SESSION_TOKEN,
  STATS_OVERVIEW,
} from "./fixtures";

/**
 * A stand-in for the Nest API, just complete enough for `kobo-frontend`'s
 * routes to render — not a second copy of the backend's business rules. It
 * exists so this suite never touches the real `backend/` or its database: the
 * question here is "does the *rendered page* fit 1264px", which needs real
 * HTML from real routes, but not a real library behind them. Every call
 * `backend-client.ts` makes succeeds and answers from the fixtures in
 * `fixtures.ts`; nothing here checks the forwarded session cookie beyond it
 * being present, because auth rejection is not what this suite is about.
 */
export function createMockApi(): Express {
  const app = express();
  app.use(express.json());

  // `EDIT_PAGE_BOOK` is reachable by id (`GET /books/:id`, direct navigation
  // in the spec) but deliberately absent from `ALL_BOOKS` / the `/books`
  // listing — it exists to stress one edit page in isolation, not to also
  // become a seventh row on `/books?page=2` and shift what that page tests.
  const books = new Map<string, Book>(
    [...ALL_BOOKS, EDIT_PAGE_BOOK].map((b) => [b.id, b]),
  );
  const listedBookIds = new Set(ALL_BOOKS.map((b) => b.id));

  app.post("/pairing", (_req, res) => {
    res.status(201).json({
      id: FIXTURE_PAIRING_ID,
      code: FIXTURE_PAIRING_CODE,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
  });

  app.get("/pairing/:id", (_req, res) => {
    res.json({ status: "pending", code: FIXTURE_PAIRING_CODE });
  });

  app.post("/pairing/:id/consume", (_req, res) => {
    res.json({ token: FIXTURE_SESSION_TOKEN });
  });

  app.get("/books", (_req, res) => {
    res.json(
      Array.from(books.values()).filter((b) => listedBookIds.has(b.id)),
    );
  });

  // §D45 — the taxonomy the form's multi-select and the list's labels read.
  app.get("/categories", (_req, res) => {
    res.json([
      {
        code: "FICTION",
        labelRo: "Ficțiune",
        labelEn: "Fiction",
        categories: [
          { code: "FICTION__GENERAL", labelRo: "Generalități", labelEn: "General" },
          { code: "FICTION__SF", labelRo: "SF", labelEn: "Science fiction" },
        ],
      },
      {
        code: "HISTORY",
        labelRo: "Istorie",
        labelEn: "History",
        categories: [
          { code: "HISTORY__GENERAL", labelRo: "Istorie generală", labelEn: "General history" },
        ],
      },
    ]);
  });

  app.get("/books/:id", (req, res) => {
    const found = books.get(req.params["id"] as string);

    if (!found) {
      res.status(404).json({ message: "not found" });
      return;
    }

    res.json(found);
  });

  app.post("/books", (req, res) => {
    const id = `book-created-${String(books.size + 1)}`;
    const now = new Date().toISOString();
    const created: Book = {
      id,
      title: (req.body as { title: string }).title,
      author: null,
      isbn: null,
      totalPages: null,
      categories: [],
      publisher: null,
      publicationYear: null,
      volume: null,
      format: null,
      description: null,
      status: "WISHLIST",
      favorite: false,
      pagesRead: 0,
      rating: null,
      estimatedPrice: null,
      paidPrice: null,
      purchasedOn: null,
      startedOn: null,
      finishedOn: null,
      coverUrl: null,
      createdAt: now,
      updatedAt: now,
      ...(req.body as Partial<Book>),
    };
    books.set(id, created);
    listedBookIds.add(id);
    res.status(201).json(created);
  });

  app.patch("/books/:id", (req, res) => {
    const existing = books.get(req.params["id"] as string);

    if (!existing) {
      res.status(404).json({ message: "not found" });
      return;
    }

    const updated: Book = {
      ...existing,
      ...(req.body as Partial<Book>),
      updatedAt: new Date().toISOString(),
    };
    books.set(updated.id, updated);
    res.json(updated);
  });

  app.post("/books/:id/purchase", (req, res) => {
    const existing = books.get(req.params["id"] as string);

    if (!existing) {
      res.status(404).json({ message: "not found" });
      return;
    }

    const updated: Book = { ...existing, status: "PURCHASED" };
    books.set(updated.id, updated);
    res.json(updated);
  });

  app.get("/stats/overview", (_req, res) => {
    res.json(STATS_OVERVIEW);
  });

  app.get("/budget/summary", (_req, res) => {
    res.json(BUDGET_SUMMARY);
  });

  return app;
}
