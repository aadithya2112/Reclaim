import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "bun dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/collection",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://recovery:recovery@localhost:5432/recovery_test" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
