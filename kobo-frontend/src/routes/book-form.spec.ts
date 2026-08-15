import { beforeEach, describe, expect, it, vi } from "vitest";
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

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

/** Routes each fetch call to a canned response by method + URL suffix. */
function mockApi(
  handlers: Array<{
    method: string;
    match: (url: string) => boolean;
    respond: (url: string, init?: RequestInit) => Promise<unknown>;
  }>,
) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = handlers.find((h) => h.method === method && h.match(url));

    return handler
      ? handler.respond(url, init)
      : jsonResponse(404, { statusCode: 404, message: "unhandled in test" });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const session = () => "session=x";

describe("book form (S1.1, S1.3, S1.4, S2.1–S2.4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /books/new", () => {
    it("requires a session", async () => {
      const res = await request(app).get("/books/new");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
    });

    it("renders an empty form defaulting to Wishlist", async () => {
      const res = await request(app).get("/books/new").set("Cookie", session());

      expect(res.text).toContain('action="/books/new"');
      expect(res.text).toContain('value="WISHLIST" selected');
    });

    it("renders every field even though the wizard script would only show some", () => {
      return request(app)
        .get("/books/new")
        .set("Cookie", session())
        .then((res) => {
          // The no-JS page is the real one: every field lives in the response
          // whether or not a script ever runs to hide the other two sections.
          for (const label of [
            "Titlu",
            "Autor",
            "ISBN",
            "Număr de pagini",
            "Categorie",
            "Editura",
            "Anul apariției",
            "Volum",
            "Format",
            "Status",
            "Pagini citite",
            "Rating",
            "Preț estimat",
            "Preț plătit",
            "Data cumpărării",
            "Data începerii",
            "Data terminării",
          ]) {
            expect(res.text).toContain(label);
          }
          expect(res.text.match(/class="wizard-section"/g)?.length).toBe(3);
        });
    });

    it("ships the sectioning script here, and does not let it creep onto the book list", async () => {
      const res = await request(app).get("/books/new").set("Cookie", session());
      expect(res.text).toContain("<script>");

      global.fetch = vi.fn((url: string) => {
        if (url.endsWith("/books")) return jsonResponse(200, []);
        if (url.endsWith("/stats/overview")) {
          return jsonResponse(200, { booksFinished: 0, booksReading: 0, pagesRead: 0, averageRating: null });
        }
        return jsonResponse(200, {
          total: 0,
          month: { month: "2026-08", spent: 0, budget: null, remaining: null },
          undated: { books: 0, total: 0 },
        });
      }) as unknown as typeof fetch;
      const list = await request(app).get("/books").set("Cookie", session());
      expect(list.text).not.toContain("<script");
    });

    it("marks saving as the page's primary action", async () => {
      const res = await request(app).get("/books/new").set("Cookie", session());

      expect(res.text).toContain('class="btn btn-primary">Salvează');
    });
  });

  describe("POST /books/new", () => {
    it("creates the book and redirects to its own page", async () => {
      const fetchMock = mockApi([
        {
          method: "POST",
          match: (url) => url.endsWith("/books"),
          respond: () => jsonResponse(201, makeBook({ id: "new-1", title: "Dune" })),
        },
      ]);

      const res = await request(app)
        .post("/books/new")
        .set("Cookie", session())
        .type("form")
        .send({ title: "Dune" });

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/books/new-1");

      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ title: "Dune" });
    });

    it("re-renders the form with the server's messages and what was typed, on a validation failure", async () => {
      mockApi([
        {
          method: "POST",
          match: (url) => url.endsWith("/books"),
          respond: () =>
            jsonResponse(400, {
              statusCode: 400,
              code: "VALIDATION_FAILED",
              message: ["title: Titlul e obligatoriu"],
            }),
        },
      ]);

      const res = await request(app)
        .post("/books/new")
        .set("Cookie", session())
        .type("form")
        .send({ title: "", author: "Cineva" });

      expect(res.status).toBe(200);
      expect(res.text).toContain("Titlul e obligatoriu");
      expect(res.text).toContain('value="Cineva"');
    });

    it("sends the reader back to pair when the session the form posted with has gone stale", async () => {
      mockApi([
        {
          method: "POST",
          match: (url) => url.endsWith("/books"),
          respond: () => jsonResponse(401, { statusCode: 401, message: "no" }),
        },
      ]);

      const res = await request(app)
        .post("/books/new")
        .set("Cookie", session())
        .type("form")
        .send({ title: "Dune" });

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
    });
  });

  describe("GET /books/:id", () => {
    it("prefills the form from the stored book", async () => {
      const book = makeBook({ id: "b1", title: "Dune", pagesRead: 143 });
      mockApi([
        {
          method: "GET",
          match: (url) => url.endsWith("/books/b1"),
          respond: () => jsonResponse(200, book),
        },
      ]);

      const res = await request(app).get("/books/b1").set("Cookie", session());

      expect(res.text).toContain("<h1>Dune</h1>");
      expect(res.text).toContain('value="143"');
      expect(res.text).toContain('action="/books/b1"');
    });

    it("offers to mark a wishlist book purchased, and not one already purchased", async () => {
      mockApi([
        {
          method: "GET",
          match: () => true,
          respond: () => jsonResponse(200, makeBook({ id: "b1", status: "WISHLIST" })),
        },
      ]);

      const res = await request(app).get("/books/b1").set("Cookie", session());

      expect(res.text).toContain('class="btn btn-primary">Marchează drept cumpărată');
    });

    it("does not offer the purchase action for a book already past wishlist", async () => {
      mockApi([
        {
          method: "GET",
          match: () => true,
          respond: () => jsonResponse(200, makeBook({ id: "b1", status: "READING" })),
        },
      ]);

      const res = await request(app).get("/books/b1").set("Cookie", session());

      expect(res.text).not.toContain("Marchează drept cumpărată");
    });
  });

  describe("POST /books/:id", () => {
    it("sends only the field that changed, per PATCH's own contract", async () => {
      const book = makeBook({ id: "b1", pagesRead: 143, status: "READING", startedOn: null });
      const fetchMock = mockApi([
        {
          method: "GET",
          match: (url) => url.endsWith("/books/b1"),
          respond: () => jsonResponse(200, book),
        },
        {
          method: "PATCH",
          match: (url) => url.endsWith("/books/b1"),
          respond: () => jsonResponse(200, { ...book, pagesRead: 200 }),
        },
      ]);

      const res = await request(app)
        .post("/books/b1")
        .set("Cookie", session())
        .type("form")
        .send({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          totalPages: String(book.totalPages),
          genre: book.genre,
          status: book.status,
          pagesRead: "200",
          rating: "",
          estimatedPrice: "",
          paidPrice: "",
          purchasedOn: book.purchasedOn,
          startedOn: "",
          finishedOn: "",
        });

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/books/b1");

      const patchCall = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit)?.method === "PATCH",
      )!;
      const body = JSON.parse((patchCall[1] as RequestInit).body as string);

      // The auto-stamp-preserving behaviour, proven through the actual route:
      // `startedOn` stayed empty and was never resubmitted as an explicit
      // null, even though the rendered field was blank.
      expect(body).toEqual({ pagesRead: 200 });
    });

    it("re-renders the edit form with errors on a validation failure, not a blank page", async () => {
      const book = makeBook({ id: "b1" });
      mockApi([
        {
          method: "GET",
          match: (url) => url.endsWith("/books/b1"),
          respond: () => jsonResponse(200, book),
        },
        {
          method: "PATCH",
          match: (url) => url.endsWith("/books/b1"),
          respond: () =>
            jsonResponse(400, {
              statusCode: 400,
              message: ["rating: Ratingul e între 1 și 5 stele"],
            }),
        },
      ]);

      const res = await request(app)
        .post("/books/b1")
        .set("Cookie", session())
        .type("form")
        .send({ title: book.title, status: book.status, rating: "9" });

      expect(res.status).toBe(200);
      expect(res.text).toContain("Ratingul e între 1 și 5 stele");
      expect(res.text).toContain(`<h1>${book.title}</h1>`);
    });
  });

  describe("POST /books/:id/purchase", () => {
    it("moves the book to purchased and returns to its page", async () => {
      mockApi([
        {
          method: "POST",
          match: (url) => url.endsWith("/purchase"),
          respond: () => jsonResponse(200, makeBook({ id: "b1", status: "PURCHASED" })),
        },
      ]);

      const res = await request(app).post("/books/b1/purchase").set("Cookie", session());

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/books/b1");
    });
  });
});
