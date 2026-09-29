const app = require('./app');
const pool = require('./db/pool');
const { missingYears } = require('./lib/holidays');

const PORT = Number(process.env.PORT) || 4000;

// Express 5 passes listen errors (e.g. port already taken) to this callback.
const server = app.listen(PORT, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use — is another LeaveFlow server running?`
      : err);
    process.exit(1);
  }
  console.log(`LeaveFlow API on http://localhost:${PORT}`);
  const thisYear = new Date().getFullYear();
  for (const y of missingYears([thisYear, thisYear + 1])) {
    console.warn(`WARNING: no public holiday list for ${y} in src/lib/holidays.js — leave in ${y} can't be booked until HR adds it`);
  }
});

// Ctrl+C (SIGINT) or a platform stop (SIGTERM): finish in-flight requests,
// close the database connections, then exit — instead of cutting them off mid-write.
function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
