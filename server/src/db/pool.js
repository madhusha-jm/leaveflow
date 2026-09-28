require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// A small set of open connections the API borrows and returns.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
