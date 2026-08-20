import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
import { BOOKS_PER_PAGE } from "../lib/pagination";
import { createApp } from "../server";
import { makeBook } from "../test/fixtures";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  API_URL: "http://backend.internal",
  TRUST_PROXY: 0,
};

const app = createApp(env);

const STATS = { booksFinished: 12, booksReading: 2, pagesRead: 3400, averageRating: 4.2 };

// §D45 — a minimal taxonomy the list resolves a book's codes against.
const CATEGORY_TREE = [
  {
    code: "FICTION",
    labelRo: "Ficțiune",
    labelEn: "Fiction",
    categories: [
      { code: "FICTION__GENERAL", labelRo: "Generalități", labelEn: "General" },
      { code: "FICTION__SF", labelRo: "SF", labelEn: "Science fiction" },
    ],
  },
];
const BUDGET = {
  total: 500,
  month: { month: "2026-08", spent: 71.5, budget: 200, remaining: 128.5 },
  undated: { books: 0, total: 0 },
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockBackend(books: unknown[]) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url.endsWith("/books")) return jsonResponse(200, books);
    if (url.endsWith("/categories")) return jsonResponse(200, CATEGORY_TREE);
    if (url.endsWith("/stats/overview")) return jsonResponse(200, STATS);
    if (url.endsWith("/budget/summary")) return jsonResponse(200, BUDGET);
    return jsonResponse(404, { statusCode: 404, message: "not found" });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("GET /books", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a device with no session to pair instead of loading anything", async () => {
    const fetchMock = mockBackend([]);

    const res = await request(app).get("/books");

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/pair");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the session cookie to every backend call it makes", async () => {
    const fetchMock = mockBackend([]);

    await request(app).get("/books").set("Cookie", "session=a-real-jwt");

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect((init?.headers as Record<string, string>)?.["Cookie"]).toBe(
        "session=a-real-jwt",
      );
    }
    // Books, categories (§D45), stats, and budget — the dashboard's two
    // requests are back on this page now that it sits beside the heading.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("shows the S8.1 dashboard figures, the same numbers /stats and /budget compute", async () => {
    mockBackend([]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("12"); // booksFinished
    expect(res.text).toContain("Cărți citite");
    expect(res.text).toContain("3.400"); // formatCount's ro-RO grouping
    expect(res.text).toContain("71.50 lei"); // month.spent
  });

  it("says the library is empty rather than show a blank list", async () => {
    mockBackend([]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("Biblioteca e goală");
  });

  it("marks adding a book as the page's primary action", async () => {
    mockBackend([]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toMatch(/class="btn btn-primary"\s+href="\/books\/new"/);
  });

  it("renders a book's title, author, and status pill", async () => {
    const book = makeBook({ id: "b1", title: "Dune", author: "Frank Herbert", status: "READING" });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("Dune");
    expect(res.text).toContain("Frank Herbert");
    expect(res.text).toContain("Citesc");
    expect(res.text).toContain('href="/books/b1"');
  });

  it("shows the progress line only for a book being read", async () => {
    const reading = makeBook({
      id: "b1",
      status: "READING",
      totalPages: 330,
      pagesRead: 143,
    });
    const wishlist = makeBook({ id: "b2", status: "WISHLIST", totalPages: null, pagesRead: 0 });
    mockBackend([reading, wishlist]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("pag. 143 din 330");
    // Only one progress paragraph — the wishlist book gets none. (The class
    // name also appears once in the page's own <style> block, hence -1.)
    expect(res.text.match(/class="book-progress"/g)?.length).toBe(1);
  });

  it("shows a book's categories, resolved to labels (§D45)", async () => {
    const book = makeBook({ id: "b1", categories: ["FICTION__SF"] });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("SF");
  });

  it("omits the category line entirely for a book on no shelf", async () => {
    const book = makeBook({ id: "b1", categories: [] });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).not.toContain('class="book-extra"');
  });

  it("shows the paid price for an owned book, never the estimate", async () => {
    const book = makeBook({
      id: "b1",
      status: "READING",
      paidPrice: 45,
      estimatedPrice: 99,
    });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("45.00 lei");
    expect(res.text).not.toContain("99.00 lei");
    expect(res.text).not.toContain("~45.00 lei"); // paid, not an estimate
  });

  it("shows the estimated price for a wishlist book, marked as an estimate", async () => {
    const book = makeBook({
      id: "b1",
      status: "WISHLIST",
      estimatedPrice: 59.99,
      paidPrice: null,
    });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("~59.99 lei");
  });

  it("shows the page count only when there is no progress line to say it instead", async () => {
    const wishlist = makeBook({ id: "b1", status: "WISHLIST", totalPages: 400, pagesRead: 0 });
    const reading = makeBook({ id: "b2", status: "READING", totalPages: 620, pagesRead: 143 });
    mockBackend([wishlist, reading]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("400 pagini");
    expect(res.text).not.toContain("620 pagini"); // said instead by "pag. 143 din 620"
  });

  it("omits the rating entirely for a book that has none, rather than show a placeholder", async () => {
    const book = makeBook({ id: "b1", rating: null });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).not.toContain("★");
    expect(res.text).not.toContain("☆");
  });

  it("shows real stars for a rated book", async () => {
    const book = makeBook({ id: "b1", status: "FINISHED", rating: 4 });
    mockBackend([book]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain("★★★★☆");
  });

  it("paginates at BOOKS_PER_PAGE, sized to fit one screen without scrolling, with a pager top and bottom", async () => {
    const books = Array.from({ length: 12 }, (_, i) => makeBook({ id: `b${i}`, title: `Book ${i}` }));
    mockBackend(books);

    const page1 = await request(app).get("/books").set("Cookie", "session=x");
    expect(page1.text).toContain("Book 0");
    expect(page1.text).not.toContain(`Book ${String(BOOKS_PER_PAGE)}`);
    const totalPages = Math.ceil(books.length / BOOKS_PER_PAGE);
    expect(page1.text.match(new RegExp(`pagina 1 din ${String(totalPages)}`, "g"))?.length).toBe(2);

    const page2 = await request(app).get("/books?page=2").set("Cookie", "session=x");
    expect(page2.text).toContain(`Book ${String(BOOKS_PER_PAGE)}`);
    expect(page2.text).not.toContain(">Book 0<");
  });

  it("shows the dashboard on the first page only, and skips its two requests elsewhere", async () => {
    const books = Array.from({ length: 12 }, (_, i) => makeBook({ id: `b${i}`, title: `Book ${i}` }));
    const fetchMock = mockBackend(books);

    const page1 = await request(app).get("/books").set("Cookie", "session=x");
    expect(page1.text).toContain("Cărți citite");
    // books + categories + stats + budget
    expect(fetchMock).toHaveBeenCalledTimes(4);

    fetchMock.mockClear();

    const page2 = await request(app).get("/books?page=2").set("Cookie", "session=x");
    expect(page2.text).not.toContain("Cărți citite");
    // books + categories only — no dashboard beyond page 1
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the session and sends the device back to pair on a 401 from the API", async () => {
    global.fetch = vi.fn(() => jsonResponse(401, { statusCode: 401, message: "no" })) as unknown as typeof fetch;

    const res = await request(app).get("/books").set("Cookie", "session=stale");

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/pair");
    const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    expect(cookies.some((c) => c.startsWith("session=;"))).toBe(true);
  });

  it("shows a plain error page rather than crash when the API is unreachable", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;

    const res = await request(app).get("/books").set("Cookie", "session=x").expect(200);

    expect(res.text).toContain("Ceva n-a mers bine");
  });

  it("draws a cover for a book with none, instead of an empty image", async () => {
    mockBackend([makeBook({ id: "b1", title: "Dune", author: "Frank Herbert", coverUrl: null })]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).not.toContain('src=""');
    expect(res.text).toContain('class="cover-placeholder"');
    expect(res.text).toContain('<span class="cover-placeholder-title">Dune</span>');
    expect(res.text).toContain('<span class="cover-placeholder-author">Frank Herbert</span>');
  });

  it("falls back to a stand-in author label on the placeholder, same as the info line", async () => {
    mockBackend([makeBook({ id: "b1", title: "Dune", author: null, coverUrl: null })]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain('<span class="cover-placeholder-author">Autor necunoscut</span>');
  });

  it("renders an <img> instead of the placeholder once a cover exists", async () => {
    mockBackend([makeBook({ id: "b1", title: "Dune", coverUrl: "/covers/b1?v=1" })]);

    const res = await request(app).get("/books").set("Cookie", "session=x");

    expect(res.text).toContain('src="/covers/b1?v=1"');
    expect(res.text).not.toContain('class="cover-placeholder"');
  });
});
