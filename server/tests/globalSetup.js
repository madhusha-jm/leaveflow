// Runs once before the whole test run: creates leaveflow_test if it doesn't
// exist yet, then applies every migration to it (schema + seed users).
require('./env');
const { Client } = require('pg');

module.exports = async () => {
  const target = new URL(process.env.DATABASE_URL);
  const dbName = target.pathname.slice(1);

  // CREATE DATABASE can't run inside the database it creates — connect to "postgres".
  const admin = new URL(target);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();

  const pool = require('../src/db/pool');
  const { migrate } = require('../src/db/migrate');
  await migrate();
  await pool.end();
};
