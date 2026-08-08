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

const session = () => "session=x";

describe("delete confirmation (S1.3, §Dialoguri)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /books/:id/delete", () => {
    it("requires a session", async () => {
      const res = await request(app).get("/books/b1/delete");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
    });

    it("names the book and offers two well-separated actions", async () => {
      global.fetch = vi.fn(() =>
        jsonResponse(200, makeBook({ id: "b1", title: "Dune" })),
      ) as unknown as typeof fetch;

      const res = await request(app).get("/books/b1/delete").set("Cookie", session());

      expect(res.text).toContain("Dune");
      expect(res.text).toContain("Anulează");
      expect(res.text).toContain(">Șterge<");
      // Stacked, not side by side — the actual requirement behind "well
      // separated" on a device with imprecise touch.
      expect(res.text).toContain("display: block");
    });

    it("cancelling goes back to the book, not to the list", async () => {
      global.fetch = vi.fn(() =>
        jsonResponse(200, makeBook({ id: "b1" })),
      ) as unknown as typeof fetch;

      const res = await request(app).get("/books/b1/delete").set("Cookie", session());

      expect(res.text).toContain('href="/books/b1">Anulează');
    });
  });

  describe("POST /books/:id/delete", () => {
    it("deletes and returns to the list", async () => {
      const fetchMock = vi.fn(() => jsonResponse(204, undefined)) as unknown as typeof fetch;
      global.fetch = fetchMock;

      const res = await request(app).post("/books/b1/delete").set("Cookie", session());

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/books");
      expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({
        method: "DELETE",
      });
    });

    it("sends an unauthenticated device to pair rather than delete anything", async () => {
      const res = await request(app).post("/books/b1/delete");

      expect(res.status).toBe(303);
      expect(res.headers.location).toBe("/pair");
    });

    it("shows an error page linking back to the book, not the list, on failure", async () => {
      global.fetch = vi.fn(() =>
        jsonResponse(400, { statusCode: 400, message: "no" }),
      ) as unknown as typeof fetch;

      const res = await request(app).post("/books/b1/delete").set("Cookie", session());

      expect(res.status).toBe(200);
      expect(res.text).toContain('href="/books/b1"');
    });
  });
});
