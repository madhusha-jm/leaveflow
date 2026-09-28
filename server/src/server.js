const app = require('./app');
const pool = require('./db/pool');

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
