import type { Request } from "express";
import { readRawBody } from "./request-body";

/**
 * The size ceiling has two halves, and only one of them is reachable through
 * an HTTP client: supertest sets `Content-Length` honestly, so a test that
 * goes through the route can only ever exercise the header check.
 *
 * The half that matters more is the other one. A client that under-reports its
 * length, or sends a chunked body with no length at all, walks straight past
 * the header and into however much memory it feels like using — unless the
 * bytes are counted as they arrive. That branch is only reachable from here.
 */
describe("readRawBody", () => {
  const LIMIT = 1_000;

  function fakeRequest(chunks: Buffer[], headers: Record<string, string>): Request {
    return {
      headers,
      async *[Symbol.asyncIterator]() {
        yield* chunks;
      },
    } as unknown as Request;
  }

  it("returns the body as it arrived", async () => {
    const body = await readRawBody(
      fakeRequest([Buffer.from("ab"), Buffer.from("cd")], {
        "content-type": "image/png",
        "content-length": "4",
      }),
      LIMIT,
    );

    expect(body).toEqual(Buffer.from("abcd"));
  });

  it("refuses on the declared length", async () => {
    await expect(
      readRawBody(
        fakeRequest([Buffer.alloc(LIMIT + 1)], {
          "content-type": "image/png",
          "content-length": String(LIMIT + 1),
        }),
        LIMIT,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 413, code: "COVER_TOO_LARGE" }));
  });

  it("drains a rejected body instead of hanging up on the client", async () => {
    // Answering mid-upload closes the connection under a client that is still
    // writing, and our 413 reaches it as a broken pipe — "network error" in
    // place of the one message written for exactly this case.
    const chunks = [Buffer.alloc(LIMIT), Buffer.alloc(LIMIT), Buffer.alloc(LIMIT)];
    let read = 0;

    const req = {
      headers: { "content-type": "image/png", "content-length": String(3 * LIMIT) },
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          read += 1;
          yield chunk;
        }
      },
    } as unknown as Request;

    await expect(readRawBody(req, LIMIT)).rejects.toThrow(
      expect.objectContaining({ status: 413, code: "COVER_TOO_LARGE" }),
    );

    expect(read).toBe(chunks.length);
  });

  it("refuses a body that exceeds the limit despite what the header claimed", async () => {
    // The header is the client's claim; the bytes are the fact.
    await expect(
      readRawBody(
        fakeRequest([Buffer.alloc(LIMIT), Buffer.alloc(1)], {
          "content-type": "image/png",
          "content-length": "10",
        }),
        LIMIT,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 413, code: "COVER_TOO_LARGE" }));
  });

  it("refuses a body that exceeds the limit with no header at all", async () => {
    await expect(
      readRawBody(
        fakeRequest([Buffer.alloc(LIMIT + 1)], { "content-type": "image/webp" }),
        LIMIT,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 413, code: "COVER_TOO_LARGE" }));
  });

  it("stops short of the limit without complaint", async () => {
    const body = await readRawBody(
      fakeRequest([Buffer.alloc(LIMIT)], { "content-type": "image/jpeg" }),
      LIMIT,
    );

    expect(body.byteLength).toBe(LIMIT);
  });

  it("wants an image content type, and says so", async () => {
    await expect(
      readRawBody(
        fakeRequest([Buffer.from("{}")], { "content-type": "application/json" }),
        LIMIT,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "COVER_FORMAT_UNSUPPORTED" }));
  });

  it("refuses a request with no content type", async () => {
    await expect(
      readRawBody(fakeRequest([Buffer.from("x")], {}), LIMIT),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "COVER_FORMAT_UNSUPPORTED" }));
  });
});
