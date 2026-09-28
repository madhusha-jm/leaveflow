// The Express app: middleware and routes, but no listening port —
// server.js starts it, and Phase 6's tests will import it directly.
const express = require('express');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.5.0', uptime: process.uptime() });
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
  if (status === 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.type === 'entity.parse.failed' ? 'INVALID_JSON'
        : status === 500 ? 'INTERNAL' : (err.code || 'ERROR'),
      message: status === 500 ? 'something went wrong' : err.message,
    },
  });
});

module.exports = app;
