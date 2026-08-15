import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Env } from "../config/env";
import { createApp } from "../server";

const env: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  API_URL: "http://backend.internal",
  TRUST_PROXY: 0,
};

const app = createApp(env);

const session = () => "session=x";

function imageResponse(status: number, headers: Record<string, string>, body = "cover-bytes") {
  return Promise.resolve({
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    arrayBuffer: () => Promise.resolve(Buffer.from(body)),
  });
}

describe("GET /covers/:bookId", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a session", async () => {
    const res = await request(app).get("/covers/b1");

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/pair");
  });

  it("forwards the reader's session and streams the image through", async () => {
    const fetchMock = vi.fn(() =>
      imageResponse(200, { "content-type": "image/jpeg", "cache-control": "private, max-age=1", etag: '"1"' }),
    ) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const res = await request(app).get("/covers/b1").set("Cookie", session());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["cache-control"]).toBe("private, max-age=1");
    expect(res.headers.etag).toBe('"1"');
    expect(Buffer.from(res.body as Buffer).toString()).toBe("cover-bytes");
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      "http://backend.internal/covers/b1",
    );
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({
      headers: { Cookie: "session=x" },
    });
  });

  it("passes a missing cover's 404 straight through", async () => {
    global.fetch = vi.fn(() => imageResponse(404, {})) as unknown as typeof fetch;

    const res = await request(app).get("/covers/b1").set("Cookie", session());

    expect(res.status).toBe(404);
  });

  it("sends a rejected session to pair rather than a broken image forever", async () => {
    global.fetch = vi.fn(() => imageResponse(401, {})) as unknown as typeof fetch;

    const res = await request(app).get("/covers/b1").set("Cookie", session());

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/pair");
  });
});
