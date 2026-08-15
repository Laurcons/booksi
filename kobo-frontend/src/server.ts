import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import type { Env } from "./config/env";
import { SESSION_COOKIE } from "./lib/session-cookie";
import { createBookDeleteRouter } from "./routes/book-delete";
import { createBookFormRouter } from "./routes/book-form";
import { createBooksListRouter } from "./routes/books-list";
import { createCoversRouter } from "./routes/covers";
import { createPairRouter } from "./routes/pair";
import { probeRouter } from "./routes/probe";
import { probeReportRouter } from "./routes/probe-report";
import { uiSwitchRouter } from "./routes/ui-switch";

/**
 * Built separately from `main.ts` so the tests can drive it with supertest
 * without binding a port or reading the real environment.
 */
export function createApp(env: Env): Express {
  const app = express();

  app.disable("x-powered-by");

  // The reverse proxy decides between this app and the SPA per request, so
  // `X-Forwarded-Proto` is how a page here learns it was reached over TLS —
  // which is one of the things the probe is there to confirm.
  if (env.TRUST_PROXY > 0) {
    app.set("trust proxy", env.TRUST_PROXY);
  }

  app.use(cookieParser());

  // The `/probe/report` form posts as ordinary urlencoded data — no fetch,
  // no JSON.stringify, because both are exactly the kind of thing that might
  // be missing on the device the report is describing.
  app.use(express.urlencoded({ extended: false }));

  // The load-bearing header of the whole arrangement. Two different
  // applications answer the same URL, chosen by User-Agent and by the `ui`
  // cookie, so any cache that ignores those would happily serve the React
  // shell to a Kobo. Set here rather than in nginx so it is true even when
  // this process is reached directly in development.
  app.use((_req, res, next) => {
    res.setHeader("Vary", "User-Agent, Cookie");
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.type("text/plain; charset=utf-8").send("ok");
  });

  // A device with no session has exactly one thing to do here — see
  // §Autentificare, docs/kobo_design.md. One with a session goes straight to
  // the one real page this surface has.
  app.get("/", (req, res) => {
    const hasSession = Boolean(
      (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE],
    );

    res.redirect(303, hasSession ? "/books" : "/pair");
  });

  app.use(probeRouter);
  app.use(probeReportRouter);
  app.use(uiSwitchRouter);
  app.use(createPairRouter(env));
  app.use(createBooksListRouter(env));
  app.use(createBookFormRouter(env));
  app.use(createBookDeleteRouter(env));
  app.use(createCoversRouter(env));

  // Everything else is still to be written. Saying so plainly beats Express's
  // default HTML 404, which on an e-reader looks indistinguishable from the
  // app being broken.
  app.use((_req, res) => {
    res
      .status(404)
      .type("text/plain; charset=utf-8")
      .send(
        "Interfața Kobo nu are încă pagina asta. Deocamdată există /probe.\n",
      );
  });

  return app;
}
