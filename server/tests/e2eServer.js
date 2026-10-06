// The API as Playwright sees it: the real server, but on the leaveflow_test
// database and port 4001, starting from empty requests/balances every run.
// Started by playwright.config.js — you don't run this by hand.
require('./env');
const { Client } = require('pg');

process.env.PORT = process.env.PORT || '4001';

(async () => {
  await require('./globalSetup')(); // create + migrate leaveflow_test

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query('TRUNCATE leave_requests, leave_balances RESTART IDENTITY CASCADE');
  await db.query('DELETE FROM holidays WHERE created_by IS NOT NULL'); // keep the seeded list
  await db.end();

  require('../src/server');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
