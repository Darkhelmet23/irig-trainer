import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3211",
    ...(process.env.CI ? {} : { channel: "msedge" }),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node server.js",
    url: "http://localhost:3211",
    env: { PORT: "3211" },
    reuseExistingServer: false,
  },
});
