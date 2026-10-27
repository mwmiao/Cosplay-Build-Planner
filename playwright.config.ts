import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const OUTBOX_DIR = "./prisma/playwright-outbox";

// Runs against a throwaway database and upload folder, never your real data.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  // The dev server compiles each page on first visit, which can take several seconds.
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Tests read English text; the app picks its language from the browser.
    locale: "en-GB",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      // Stand-in for RSS-Bridge (Instagram monitor tests): fixture feeds, no network.
      command: "node tests/fixtures/rss-bridge-mock.mjs",
      url: "http://127.0.0.1:3199/",
      reuseExistingServer: false,
    },
    {
      // Fresh test database each run, then a dev server on PORT.
      command: `node -e "require('fs').rmSync('${OUTBOX_DIR}',{recursive:true,force:true})" && node node_modules/prisma/build/index.js migrate reset --force --skip-seed && node node_modules/next/dist/bin/next dev -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "file:./playwright.db",
        UPLOAD_DIR: "./data/playwright-uploads",
        APP_URL: `http://127.0.0.1:${PORT}`,
        AUTH_SECRET: "playwright-auth-secret-0123456789abcdef0123456789",
        // Test-only: reset emails are written here instead of being sent.
        EMAIL_OUTBOX_DIR: OUTBOX_DIR,
        SMTP_HOST: "",
        // No outside requests during tests; the events check is tested with fixtures.
        EVENT_SYNC_HOURS: "0",
        // The Instagram monitor is driven by the admin buttons in tests, against
        // fixture feeds served by tests/fixtures/rss-bridge-mock.mjs.
        INSTAGRAM_MONITOR_ENABLED: "false",
        RSS_BRIDGE_BASE_URL: "http://127.0.0.1:3199",
      },
    },
  ],
});
