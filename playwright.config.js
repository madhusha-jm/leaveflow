// End-to-end tests: a real browser clicking through the real app.
// `npm run test:e2e` (repo root) starts its OWN copies of both tiers:
//   API    on :4001 against leaveflow_test (emptied at start) — see server/tests/e2eServer.js
//   client on :5174, proxying /api to :4001
// so your dev servers (4000 / 5173) and dev database are never touched.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  // Each expect() retries for up to 10 s (default 5 s): the first page load waits for
  // Vite to compile, which on a busy laptop (e.g. Docker just starting) can exceed 5 s.
  expect: { timeout: 10_000 },
  workers: 1, // one shared test database — specs must not run at the same time
  use: {
    baseURL: 'http://localhost:5174',
    // Locally: the Edge that ships with Windows (no download). In CI (Linux): Playwright's Chromium.
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure', // on failure: npx playwright show-trace test-results/…/trace.zip
  },
  webServer: [
    {
      command: 'node tests/e2eServer.js',
      cwd: 'server',
      url: 'http://localhost:4001/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      cwd: 'client',
      url: 'http://localhost:5174',
      env: { API_URL: 'http://localhost:4001' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
