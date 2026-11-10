import { defineConfig, devices } from '@playwright/test';

// Spec T4.3 / R7.1: built static apps served with `vite preview`, tested in real Chromium.
// Memory-safe: one worker, one browser. Build each app first:
//   (cd ../apps/planner && npm ci && npm run build); same for ../apps/inventory
const serve = (app: string, port: number) => ({
  command: `./node_modules/.bin/vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  cwd: `../apps/${app}`,
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: !process.env['CI'],
  timeout: 60_000,
});

export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: { trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [serve('planner', 4173), serve('inventory', 4174)],
});
