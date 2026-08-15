import type { Book, BudgetSummary, StatsOverview } from "@bookcsi/shared";

/**
 * Data for the no-scroll suite, deliberately worse than the demo data
 * anywhere else in the repo. §Paginare ties the count to this measurement.
 * This file is what a real page looks like when nobody picked friendly content
 * for it. A harness that only ever renders "Dune" by
 * "Frank Herbert" would pass regardless of whether the budget actually holds.
 */

function book(overrides: Partial<Book> & Pick<Book, "id" | "title">): Book {
  return {
    author: "Autor necunoscut",
    isbn: null,
    totalPages: 300,
    genre: "FICTION",
    status: "READING",
    favorite: false,
    pagesRead: 0,
    rating: null,
    estimatedPrice: null,
    paidPrice: null,
    purchasedOn: null,
    startedOn: null,
    finishedOn: null,
    coverUrl: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Long enough to wrap well past the "pe două rânduri maxim" the design
 * document asks for (§Componente/Lista de cărți). This checks that the
 * rendered clamp, rather than friendly fixture text, keeps that rule real.
 */
const VERY_LONG_TITLE =
  "O istorie foarte lungă și amănunțită a bibliotecilor uitate din estul Europei, cu note de subsol despre catalogare, restaurare și cataloage pierdute în cel de-al Doilea Război Mondial";

/** Six books ensure a later paginated page is reachable; the first two are the longest active-row combination. */
export const PAGE_ONE_BOOKS: Book[] = [
  book({
    id: "book-reading",
    title: "Dune",
    author: "Frank Herbert",
    status: "READING",
    pagesRead: 143,
    totalPages: 620,
    createdAt: "2026-07-30T10:00:00.000Z",
  }),
  book({
    id: "book-long-title",
    title: VERY_LONG_TITLE,
    author: "Un Autor Cu Un Nume La Fel De Lung Precum Titlul De Alături",
    status: "WISHLIST",
    createdAt: "2026-07-29T10:00:00.000Z",
  }),
  book({
    id: "book-finished",
    title: "Fundația",
    author: "Isaac Asimov",
    status: "FINISHED",
    rating: 5,
    pagesRead: 255,
    totalPages: 255,
    // Every metadata field a row can carry, all at once — genre (default
    // FICTION), rating, and now a price too — the actual worst case for the
    // one-line metadata row, not just a long title.
    paidPrice: 45.5,
    createdAt: "2026-07-28T10:00:00.000Z",
  }),
  book({
    id: "book-abandoned",
    title: "Ulise",
    author: "James Joyce",
    status: "ABANDONED",
    rating: 2,
    pagesRead: 80,
    totalPages: 730,
    createdAt: "2026-07-27T10:00:00.000Z",
  }),
  book({
    id: "book-purchased",
    title: "Numele trandafirului",
    author: "Umberto Eco",
    status: "PURCHASED",
    createdAt: "2026-07-26T10:00:00.000Z",
  }),
];

/**
 * Padded past a single book: the 2-column grid rounds 5 or 6 books up to the
 * same 3 rows, so finding the real row ceiling needs enough books to reach a
 * 4th row (7+) — one leftover book was never enough to tell "fits" from
 * "rounds to the same answer as fewer books would have."
 */
export const PAGE_TWO_BOOKS: Book[] = [
  book({
    id: "book-page-two",
    title: "O carte oarecare de pe pagina a doua",
    author: "Cineva",
    status: "WISHLIST",
    createdAt: "2026-07-01T10:00:00.000Z",
  }),
  book({
    id: "book-extra-1",
    title: "Crimă și pedeapsă",
    author: "Feodor Dostoievski",
    status: "FINISHED",
    rating: 4,
    genre: "FICTION",
    paidPrice: 32,
    pagesRead: 671,
    totalPages: 671,
    createdAt: "2026-06-28T10:00:00.000Z",
  }),
  book({
    id: "book-extra-2",
    title: "O scurtă istorie a aproape totul",
    author: "Bill Bryson",
    status: "READING",
    genre: "NONFICTION",
    pagesRead: 210,
    totalPages: 544,
    createdAt: "2026-06-27T10:00:00.000Z",
  }),
  book({
    id: "book-extra-3",
    title: "1984",
    author: "George Orwell",
    status: "PURCHASED",
    genre: "SCIFI",
    paidPrice: 25.5,
    createdAt: "2026-06-26T10:00:00.000Z",
  }),
  book({
    id: "book-extra-4",
    title: "Sapiens: o scurtă istorie a omenirii",
    author: "Yuval Noah Harari",
    status: "FINISHED",
    rating: 5,
    genre: "NONFICTION",
    paidPrice: 48,
    pagesRead: 464,
    totalPages: 464,
    createdAt: "2026-06-25T10:00:00.000Z",
  }),
  book({
    id: "book-extra-5",
    title: "Micul prinț",
    author: "Antoine de Saint-Exupéry",
    status: "WISHLIST",
    genre: "FICTION",
    estimatedPrice: 18.99,
    createdAt: "2026-06-24T10:00:00.000Z",
  }),
];

export const ALL_BOOKS: Book[] = [...PAGE_ONE_BOOKS, ...PAGE_TWO_BOOKS];

/**
 * The edit-page worst case: `WISHLIST` so the purchase button renders
 * (`renderEditPage`'s conditional extra `<form>`), combined with the same
 * long title used above — `book-form.ts`'s `<h1>` prints it verbatim too, so
 * this book stresses both the wizard step and the untruncated heading at
 * once.
 */
export const EDIT_PAGE_BOOK: Book = book({
  id: "book-edit-worst-case",
  title: VERY_LONG_TITLE,
  author: "Un Autor Cu Un Nume La Fel De Lung Precum Titlul De Alături",
  status: "WISHLIST",
  estimatedPrice: 59.99,
  createdAt: "2026-07-15T10:00:00.000Z",
});

export const STATS_OVERVIEW: StatsOverview = {
  booksFinished: 12,
  booksReading: 2,
  pagesRead: 3841,
  averageRating: 4.2,
};

export const BUDGET_SUMMARY: BudgetSummary = {
  total: 842.5,
  month: {
    month: "2026-08",
    spent: 142,
    budget: 200,
    remaining: 58,
  },
  undated: { books: 1, total: 39.99 },
};

/** Any non-empty string works — the mock API never actually checks it, only `requireSession` cares that the cookie exists at all. */
export const FIXTURE_SESSION_TOKEN = "e2e-fixture-session";

export const FIXTURE_PAIRING_ID = "pairing-e2e-fixture";
export const FIXTURE_PAIRING_CODE = "ABC234";
