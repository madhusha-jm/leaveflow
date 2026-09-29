const { Pool, types } = require('pg');
const { databaseUrl } = require('../config');
const { logger } = require('../middleware/logging');

// DATE (OID 1082): keep 'YYYY-MM-DD' strings. The default turns them into
// local-midnight JS Dates, which shifts them a day back in UTC+5:30.
types.setTypeParser(1082, (v) => v);
// NUMERIC (OID 1700): day counts like 2.0 / 0.5 — small enough for a JS number.
types.setTypeParser(1700, (v) => Number(v));

// A small set of open connections the API borrows and returns.
const pool = new Pool({ connectionString: databaseUrl });

// An idle connection can die (e.g. the database restarts). Without a listener
// that error would crash the whole API; with one, the pool just replaces it.
pool.on('error', (err) => logger.error({ err }, 'Postgres idle client error'));

module.exports = pool;
