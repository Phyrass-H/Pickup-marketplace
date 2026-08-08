import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The money tests (BACKLOG § H2). Pure functions only — no DB, no browser, no
// React — so the suite runs in a second and can gate every commit.
//
// `@/` mirrors the tsconfig path alias, so a test imports exactly what the app
// imports; there is no second module graph to drift.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
