import { loadDotEnv, validateEnv } from "./config/env";
import { createApp } from "./server";

function bootstrap(): void {
  loadDotEnv();

  const env = validateEnv(process.env as Record<string, unknown>);
  const app = createApp(env);

  app.listen(env.PORT, () => {
    // The same reasoning as the backend's boot log: the settings that are
    // wrong silently are the ones worth printing. A `TRUST_PROXY` of 0 behind
    // a proxy makes the probe report "not TLS" on a site that is.
    console.log(
      `Kobo frontend listening on http://localhost:${env.PORT} · ` +
        `env: ${env.NODE_ENV} · API: ${env.API_URL} · ` +
        `trust proxy: ${env.TRUST_PROXY > 0 ? env.TRUST_PROXY : "off"}`,
    );
    console.log(`Probe at http://localhost:${env.PORT}/probe`);
  });
}

bootstrap();
