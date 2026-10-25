import { defineConfig, devices } from "@playwright/test";

// Runs against a real Docker container (started by CI), not a dev server.
// See .github/workflows/docker.yml → job "container".
export default defineConfig({
  testDir: "./tests-container",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.CONTAINER_URL ?? "http://127.0.0.1:1337",
    locale: "en-GB",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
