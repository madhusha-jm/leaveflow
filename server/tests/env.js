// Runs before anything else in every test process (jest `setupFiles` + globalSetup).
// Points the app at a SEPARATE database — leaveflow_test on the same Postgres as
// your .env — so a test run can never touch your development data.
require('dotenv').config({ quiet: true });

const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
url.pathname = '/leaveflow_test';

process.env.NODE_ENV = 'test'; // also silences the morgan request log
process.env.DATABASE_URL = url.toString();
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-else';

// Belt and braces: the tests truncate tables, so refuse anything that isn't a _test database.
if (!url.pathname.endsWith('_test')) {
  throw new Error(`Refusing to run tests against ${url.pathname}`);
}
