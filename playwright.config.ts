import { defineConfig, devices } from "@playwright/test";

// CI runs the flows against a production build (#17); locally they run
// against the dev server.
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // A test.only left in by mistake fails CI instead of skipping the rest.
  forbidOnly: ci,
  // One retry in CI, where a slow runner can miss a 5 second wait.
  retries: ci ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: ci ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
