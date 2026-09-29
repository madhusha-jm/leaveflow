// The Express app: middleware and routes, but no listening port —
// server.js starts it, and Phase 6's tests will import it directly.
const express = require('express');
const helmet = require('helmet');
const { httpLogger, logger } = require('./middleware/logging');
const pool = require('./db/pool');

const app = express();
// Behind a proxy (nginx in docker compose, a load balancer in the cloud) every request
// arrives from the proxy's IP. TRUST_PROXY=1 trusts one hop of X-Forwarded-For, so the
// login rate limit counts real clients instead of lumping everyone together.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(helmet()); // standard security headers (no sniffing, no framing, etc.)
// One JSON log line per request, with a request id and the auth header redacted.
app.use(httpLogger);
// No legitimate request is anywhere near 10 kB; a huge body is a mistake or an attack.
app.use(express.json({ limit: '10kb' }));

// "ok" means the API *and* the database answer — a monitor can alert on 503.
app.get('/api/health', async (req, res) => {
  const body = { status: 'ok', version: '0.6.0', uptime: process.uptime(), db: 'ok' };
  try {
    await pool.query('SELECT 1');
    res.json(body);
  } catch {
    res.status(503).json({ ...body, status: 'degraded', db: 'unreachable' });
  }
});

app.use('/api', require('./routes/auth')); // POST /api/auth/login, GET /api/me
app.use('/api/leave-requests', require('./routes/leaveRequests'));
app.use('/api/balances', require('./routes/balances'));
app.use('/api/team', require('./routes/team'));

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'no such endpoint' } });
});

// Postgres error codes that mean "the client sent something invalid", not "we crashed".
const PG_CLIENT_ERRORS = {
  '23503': 'a referenced record does not exist',   // foreign key violation
  '23514': 'a value breaks a database rule',       // check violation
  '22007': 'invalid date',                         // invalid datetime format
  '22P02': 'invalid number',                       // invalid text representation
};

// Every thrown error lands here, so the { error: { code, message } } shape lives in one place.
app.use((err, req, res, next) => {
  if (PG_CLIENT_ERRORS[err.code]) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: PG_CLIENT_ERRORS[err.code] },
    });
  }
  const status = err.status || 500;
  if (status === 500) logger.error({ err, reqId: req.id }, 'unhandled error');
  // body-parser errors carry a `type` instead of our codes.
  const BODY_ERRORS = { 'entity.parse.failed': 'INVALID_JSON', 'entity.too.large': 'PAYLOAD_TOO_LARGE' };
  res.status(status).json({
    error: {
      code: BODY_ERRORS[err.type] || (status === 500 ? 'INTERNAL' : (err.code || 'ERROR')),
      message: status === 500 ? 'something went wrong' : err.message,
    },
  });
});

module.exports = app;
