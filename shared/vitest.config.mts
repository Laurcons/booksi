import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Contracts and pure functions — nothing here touches a DOM, and the two
    // things that do have environment-shaped behaviour (`Intl.PluralRules`,
    // `Intl.NumberFormat`) are Node's own.
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
