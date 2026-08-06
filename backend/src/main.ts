import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env";

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

  const port = config.get("PORT", { infer: true });
  await app.listen(port);

  new Logger("Bootstrap").log(`API listening on http://localhost:${port}`);
}

void bootstrap();
