import { Router } from "express";
import type { Env } from "../config/env";
import { getCoverImage } from "../lib/backend-client";
import { requireSession, sessionCookieFrom } from "../lib/require-session";
import { handleBackendError } from "../lib/route-errors";

/**
 * The Kobo's browser never talks to the API directly (`env.ts`'s note on
 * `API_URL`: "requests go server to server with the reader's session cookie
 * forwarded along") — but an `<img>` tag is the browser making its own
 * request, so `book.coverUrl` can't be handed to it as-is the way the React
 * app does. This gives the device the same path (`cover-url.ts` already
 * produces `/covers/{id}?v=...`, matched here regardless of query string) and
 * fetches the bytes itself, the same way every other authenticated route
 * here already does.
 */
export function createCoversRouter(env: Env): Router {
  const router = Router();
  router.use(requireSession);

  router.get("/covers/:bookId", async (req, res) => {
    const session = sessionCookieFrom(req)!;
    const bookId = req.params["bookId"]!;

    try {
      const cover = await getCoverImage(env, req.headers["user-agent"], session, bookId);

      if (cover.status !== 200) {
        res.sendStatus(cover.status);
        return;
      }

      res.set("Content-Type", cover.contentType ?? "application/octet-stream");
      if (cover.cacheControl !== null) {
        res.set("Cache-Control", cover.cacheControl);
      }
      if (cover.etag !== null) {
        res.set("ETag", cover.etag);
      }
      res.send(cover.body);
    } catch (error) {
      if (handleBackendError(error, res)) {
        return;
      }
      res.sendStatus(502);
    }
  });

  return router;
}
