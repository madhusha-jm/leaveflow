const app = require('./app');
const pool = require('./db/pool');
const { logger } = require('./middleware/logging');
const { missingYears } = require('./lib/holidays');

const PORT = Number(process.env.PORT) || 4000;

// Express 5 passes listen errors (e.g. port already taken) to this callback.
const server = app.listen(PORT, (err) => {
  if (err) {
    logger.fatal(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use — is another LeaveFlow server running?`
      : err);
    process.exit(1);
  }
  logger.info(`LeaveFlow API on http://localhost:${PORT}`);
  const thisYear = new Date().getFullYear();
  missingYears(pool, [thisYear, thisYear + 1])
    .then((years) => years.forEach((y) => logger.warn(
      `no public holidays for ${y} in the holidays table — leave in ${y} can't be booked until HR adds them`)))
    .catch((err) => logger.error({ err }, 'could not check the holiday calendar'));
});

// Ctrl+C (SIGINT) or a platform stop (SIGTERM): finish in-flight requests,
// close the database connections, then exit — instead of cutting them off mid-write.
function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // don't hang forever
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
