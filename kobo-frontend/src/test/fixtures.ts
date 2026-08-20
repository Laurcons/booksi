import type { Book } from "@bookcsi/shared";

/** A complete book; each test overrides only the field it is about — same convention as the React app's own `makeBook`. */
export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Dune",
    author: "Frank Herbert",
    isbn: "978-606-4-00000-0",
    totalPages: 620,
    categories: ["FICTION__GENERAL"],
    publisher: null,
    publicationYear: null,
    volume: null,
    format: null,
    // §D40 — carried because `Book` has the column, not because the Kobo shows
    // it: the description is a web-only surface for now, and an e-ink screen
    // that must not scroll (kobo_design.md) is its own design problem.
    description: null,
    status: "READING",
    favorite: false,
    pagesRead: 143,
    rating: null,
    estimatedPrice: null,
    paidPrice: null,
    purchasedOn: "2026-07-01",
    startedOn: "2026-07-20",
    finishedOn: null,
    coverUrl: null,
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}
