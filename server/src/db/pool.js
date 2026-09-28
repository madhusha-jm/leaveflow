require('dotenv').config({ quiet: true });
const { Pool, types } = require('pg');

// DATE (OID 1082): keep 'YYYY-MM-DD' strings. The default turns them into
// local-midnight JS Dates, which shifts them a day back in UTC+5:30.
types.setTypeParser(1082, (v) => v);
// NUMERIC (OID 1700): day counts like 2.0 / 0.5 — small enough for a JS number.
types.setTypeParser(1700, (v) => Number(v));

// A small set of open connections the API borrows and returns.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
