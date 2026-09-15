import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, viewport: { width: 390, height: 844 } }
});
