// Applies every migrations/*.sql file exactly once, in filename order.
// The schema_migrations table is the ledger of what has already run.
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const dir = path.join(__dirname, 'migrations');

// db: the shared pool by default; test setup passes its own short-lived one.
async function migrate(db = pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const seen = await db.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (seen.rowCount) continue;
    // One transaction per file: a failing migration leaves nothing half-applied.
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('applied', file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${file} failed: ${err.message}`, { cause: err });
    } finally {
      client.release();
    }
  }
}

module.exports = { migrate };

// `npm run migrate` runs this file directly; the test setup imports migrate() instead.
if (require.main === module) {
  migrate()
    .catch((err) => { console.error(err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
