import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";
import { setupOpenApi } from "./docs/openapi";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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

  // Validation is per parameter, through `ZodValidationPipe` fed by the
  // schemas in `shared/` — see the note on the pipe for why it is not global.

  // Off in production: this is a single-user API, and a public page listing
  // every route buys nothing that would justify the surface. Set
  // ENABLE_DOCS=true to override.
  const isProduction = config.get("NODE_ENV", { infer: true }) === "production";
  const docsEnabled = config.get("ENABLE_DOCS", { infer: true }) ?? !isProduction;

  if (docsEnabled) {
    setupOpenApi(app);
  }

  const port = config.get("PORT", { infer: true });
  await app.listen(port);

  const log = new Logger("Bootstrap");
  log.log(`API listening on http://localhost:${port}`);
  if (docsEnabled) {
    log.log(`API docs on http://localhost:${port}/docs`);
  }
}

void bootstrap();
