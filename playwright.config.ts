import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const OUTBOX_DIR = "./prisma/playwright-outbox";

// Runs against a throwaway database and upload folder, never your real data.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
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
  webServer: {
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
    },
  },
});
