import type { Book, BudgetSummary, StatsOverview } from "@bookcsi/shared";

/**
 * Data for the no-scroll suite, deliberately worse than the demo data
 * anywhere else in the repo. §Paginare's own comment on `BOOKS_PER_PAGE`
 * calls the count "arithmetic, not a measurement... correct it after looking
 * at a real page" — this file is what a real page looks like when nobody
 * picked friendly content for it. A harness that only ever renders "Dune" by
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
 * document asks for (§Componente/Lista de cărți) — nothing in `bookRow()`
 * actually caps it (no `-webkit-line-clamp`, no character truncation), so
 * this is the fixture that tests whether that line is a real rule or a hope.
 */
const VERY_LONG_TITLE =
  "O istorie foarte lungă și amănunțită a bibliotecilor uitate din estul Europei, cu note de subsol despre catalogare, restaurare și cataloage pierdute în cel de-al Doilea Război Mondial";

/** Five books — exactly `BOOKS_PER_PAGE` — so page 1 carries the dashboard *and* the fullest row count at once, the worst combination the router ever renders together. */
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

/** One extra book so `/books?page=2` is reachable and renders without the dashboard. */
export const PAGE_TWO_BOOKS: Book[] = [
  book({
    id: "book-page-two",
    title: "O carte oarecare de pe pagina a doua",
    author: "Cineva",
    status: "WISHLIST",
    createdAt: "2026-07-01T10:00:00.000Z",
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
