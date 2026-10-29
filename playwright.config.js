import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 20000,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3100', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
