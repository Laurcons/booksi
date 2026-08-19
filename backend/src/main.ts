import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";
import { setupOpenApi } from "./docs/openapi";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // The session arrives as a cookie, so it has to be parsed before any guard
  // looks for it.
  app.use(cookieParser());

  // §D20: credentialed CORS forbids a wildcard origin, so the one allowed
  // origin is configuration rather than a constant.
  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  // Validation is per parameter, through the `@Validated*` decorators in
  // `common/validated.ts`, fed by the schemas in `shared/` — see the note
  // there for why it is not global, and why a decorator rather than a pipe.

  const isProduction = config.get("NODE_ENV", { infer: true }) === "production";

  // Rate limiting counts per client IP, and behind a proxy every request
  // carries the proxy's address instead. Only enabled when there really is a
  // proxy: trusting `X-Forwarded-For` without one lets a client name its own
  // IP and step around the limiter entirely.
  const trustProxy = config.get("TRUST_PROXY", { infer: true });
  if (trustProxy > 0) {
    app.set("trust proxy", trustProxy);
  }

  // So a SIGTERM closes the database pool instead of dropping it.
  app.enableShutdownHooks();

  // Off in production: a public page listing every route buys nothing that
  // would justify the surface. Set ENABLE_DOCS=true to override.
  const docsEnabled = config.get("ENABLE_DOCS", { infer: true }) ?? !isProduction;

  if (docsEnabled) {
    setupOpenApi(app);
  }

  const port = config.get("PORT", { infer: true });
  await app.listen(port);

  const log = new Logger("Bootstrap");
  log.log(`API listening on http://localhost:${port}`);

  // The security posture, stated rather than inferred. Every line here is
  // something a misconfigured deployment gets wrong silently — a session
  // cookie without `Secure`, docs open to the internet, a limiter that sees
  // one IP for everybody. Reading it back at boot is what turns those from
  // "nobody noticed for a month" into "it says so in the first screen of logs".
  log.log(
    `Environment: ${config.get("NODE_ENV", { infer: true })} · ` +
      `secure cookies: ${isProduction ? "on" : "OFF"} · ` +
      `docs: ${docsEnabled ? "on" : "off"} · ` +
      `trust proxy: ${trustProxy > 0 ? trustProxy : "off"}`,
  );

  if (isProduction && !trustProxy) {
    log.warn(
      "TRUST_PROXY is 0 in production: if the API sits behind a proxy, rate " +
        "limiting is counting every request against the proxy's IP.",
    );
  }

  if (docsEnabled) {
    log.log(`API docs on http://localhost:${port}/docs`);
  }
}

void bootstrap();
