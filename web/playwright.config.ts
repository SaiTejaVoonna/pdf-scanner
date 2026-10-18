import { defineConfig } from '@playwright/test';

// Locally the pre-installed Chromium can be used via CHROMIUM_PATH; in CI run `npx playwright install chromium`.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1, // heavy image work in several browsers at once makes timings flaky
  retries: 0,
  reporter: [['list']],
  webServer: { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  use: {
    baseURL: 'http://localhost:4173',
    acceptDownloads: true,
    launchOptions: {
      executablePath,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
    },
  },
});
