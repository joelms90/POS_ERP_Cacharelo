import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../sync_api && PORT=3000 NODE_ENV=development DATABASE_URL="postgres://pos_user:pos_password@localhost:5432/pos_dev" npm run dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'VITE_API_URL=http://localhost:3000/api pnpm dev',
      url: 'http://localhost:1420',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
