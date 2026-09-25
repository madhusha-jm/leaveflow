const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const MAX_DAYS = 30;

function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

// YYYY-MM-DD only — string comparison of dates is only safe in this format.
function isDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && !Number.isNaN(new Date(v).getTime());
}

function findRequest(id) {
  return db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// List requests, optionally filtered: GET /api/leave-requests?status=PENDING
app.get('/api/leave-requests', (req, res, next) => {
  const { status } = req.query;
  if (status === undefined) {
    return res.json(db.prepare('SELECT * FROM leave_requests ORDER BY id').all());
  }
  if (!STATUSES.includes(status)) {
    return next(httpError(400, 'VALIDATION_ERROR',
      'status must be one of ' + STATUSES.join(', ')));
  }
  res.json(db.prepare('SELECT * FROM leave_requests WHERE status = ? ORDER BY id').all(status));
});

// Create: validate first, insert second, respond 201 last.
app.post('/api/leave-requests', (req, res, next) => {
  const { user_id, start_date, end_date, reason } = req.body || {};
  if (!user_id || !start_date || !end_date) {
    return next(httpError(400, 'VALIDATION_ERROR',
      'user_id, start_date and end_date are required'));
  }
  if (!isDate(start_date) || !isDate(end_date)) {
    return next(httpError(400, 'VALIDATION_ERROR',
      'start_date and end_date must be YYYY-MM-DD'));
  }
  if (end_date < start_date) {
    return next(httpError(400, 'VALIDATION_ERROR',
      'end_date must be on or after start_date'));
  }
  const days = (new Date(end_date) - new Date(start_date)) / 86400000 + 1; // inclusive
  if (days > MAX_DAYS) {
    return next(httpError(400, 'VALIDATION_ERROR',
      `a request may span at most ${MAX_DAYS} days`));
  }
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(user_id)) {
    return next(httpError(400, 'VALIDATION_ERROR', 'no such user_id'));
  }
  const result = db.prepare(
    `INSERT INTO leave_requests (user_id, start_date, end_date, reason)
     VALUES (?, ?, ?, ?)`
  ).run(user_id, start_date, end_date, reason || null);
  res.status(201).json(findRequest(result.lastInsertRowid));
});

// Decide: PENDING -> APPROVED | REJECTED. Anything else is a 409.
app.patch('/api/leave-requests/:id', (req, res, next) => {
  const { action, decided_by } = req.body || {};
  if (action !== 'approve' && action !== 'reject') {
    return next(httpError(400, 'VALIDATION_ERROR',
      'action must be "approve" or "reject"'));
  }
  const row = findRequest(req.params.id);
  if (!row) return next(httpError(404, 'NOT_FOUND', 'no such leave request'));
  if (row.status !== 'PENDING') {
    return next(httpError(409, 'INVALID_STATE', 'request is already ' + row.status));
  }
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  db.prepare(
    `UPDATE leave_requests SET status = ?, decided_by = ?,
     decided_at = datetime('now') WHERE id = ?`
  ).run(status, decided_by || null, req.params.id);
  res.json(findRequest(req.params.id));
});

// Cancel: PENDING -> CANCELLED. The row is kept, only its status changes.
app.delete('/api/leave-requests/:id', (req, res, next) => {
  const row = findRequest(req.params.id);
  if (!row) return next(httpError(404, 'NOT_FOUND', 'no such leave request'));
  if (row.status !== 'PENDING') {
    return next(httpError(409, 'INVALID_STATE', 'request is already ' + row.status));
  }
  db.prepare("UPDATE leave_requests SET status = 'CANCELLED' WHERE id = ?")
    .run(req.params.id);
  res.json(findRequest(req.params.id));
});

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'no such endpoint' } });
});

// Every next(err) lands here, so the { error: { code, message } } shape lives in one place.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || (err.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'INTERNAL'),
      message: status === 500 ? 'something went wrong' : err.message,
    },
  });
});

app.listen(4000, () => console.log('LeaveFlow v0 on http://localhost:4000'));
