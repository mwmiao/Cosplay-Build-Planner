import path from "node:path";
import { defineConfig } from "vitest/config";

// Fast unit tests for src/lib (no browser, no server). The browser flows live in tests/ (Playwright).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // "server-only" throws outside Next.js; an empty module lets lib code be imported here.
      "server-only": path.resolve(process.cwd(), "tests-unit/server-only-stub.ts"),
    },
  },
  test: { include: ["tests-unit/**/*.test.ts"] },
});
