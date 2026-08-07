import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import type { Env } from "./config/env";
import { probeRouter } from "./routes/probe";
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

  app.use(probeRouter);
  app.use(uiSwitchRouter);

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
