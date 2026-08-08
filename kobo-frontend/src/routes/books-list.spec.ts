import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    expect(page1.text).not.toContain("Book 5");
    expect(page1.text.match(/pagina 1 din 3/g)?.length).toBe(2);

    const page2 = await request(app).get("/books?page=2").set("Cookie", "session=x");
    expect(page2.text).toContain("Book 5");
    expect(page2.text).not.toContain(">Book 0<");
  });

  it("shows the dashboard on the first page only, and skips its two requests elsewhere", async () => {
    const books = Array.from({ length: 12 }, (_, i) => makeBook({ id: `b${i}`, title: `Book ${i}` }));
    const fetchMock = mockBackend(books);

    const page1 = await request(app).get("/books").set("Cookie", "session=x");
    expect(page1.text).toContain("Cărți citite");
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockClear();

    const page2 = await request(app).get("/books?page=2").set("Cookie", "session=x");
    expect(page2.text).not.toContain("Cărți citite");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
