import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No DOM anywhere in this workspace — the whole point is that the HTML is
    // finished before it leaves the server. What the tests assert on is
    // rendered strings and HTTP responses.
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
