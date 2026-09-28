const express = require('express');
const pool = require('../db/pool');
const httpError = require('../lib/httpError');
const { isDate, calendarDays, leaveDays } = require('../lib/dates');
const { getBalances } = require('../lib/balances');

const router = express.Router();

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const MAX_CALENDAR_DAYS = 30;

// List, optionally filtered: GET /api/leave-requests?status=PENDING
// (Part C makes this role-aware: employees see only their own.)
router.get('/', async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) {
    throw httpError(400, 'VALIDATION_ERROR', 'status must be one of ' + STATUSES.join(', '));
  }
  const { rows } = status === undefined
    ? await pool.query('SELECT * FROM leave_requests ORDER BY created_at DESC, id DESC')
    : await pool.query(
        'SELECT * FROM leave_requests WHERE status = $1 ORDER BY created_at DESC, id DESC',
        [status]);
  res.json(rows);
});

// Create — checks in the order docs/api.md lists them: cheap validation first,
// then overlap, then balance, and the write last.
router.post('/', async (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body || {};
  const userId = Number(req.body?.user_id); // TEMP — Part C takes this from the JWT

  if (!userId || !leave_type_id || !start_date || !end_date) {
    throw httpError(400, 'VALIDATION_ERROR',
      'user_id, leave_type_id, start_date and end_date are required');
  }
  if (!isDate(start_date) || !isDate(end_date)) {
    throw httpError(400, 'VALIDATION_ERROR', 'start_date and end_date must be YYYY-MM-DD');
  }
  if (end_date < start_date) {
    throw httpError(400, 'VALIDATION_ERROR', 'end_date must be on or after start_date');
  }
  if (calendarDays(start_date, end_date) > MAX_CALENDAR_DAYS) {
    throw httpError(400, 'VALIDATION_ERROR',
      `a request may span at most ${MAX_CALENDAR_DAYS} days`);
  }
  const days = leaveDays(start_date, end_date);
  if (days === 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'the range contains no working days');
  }
  const user = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (!user.rowCount) throw httpError(400, 'VALIDATION_ERROR', 'no such user_id');

  const overlap = await pool.query(
    `SELECT id, status, start_date, end_date FROM leave_requests
      WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED')
        AND start_date <= $3 AND end_date >= $2
      LIMIT 1`,
    [userId, start_date, end_date]);
  if (overlap.rowCount) {
    const o = overlap.rows[0];
    throw httpError(409, 'OVERLAPPING_REQUEST',
      `overlaps your ${o.status} request #${o.id} (${o.start_date} to ${o.end_date})`);
  }

  const year = Number(start_date.slice(0, 4));
  const balance = (await getBalances(pool, userId, year))
    .find((b) => b.leave_type_id === Number(leave_type_id));
  if (!balance) throw httpError(400, 'VALIDATION_ERROR', 'no such leave_type_id');
  if (days > balance.available) {
    throw httpError(409, 'INSUFFICIENT_BALANCE',
      `only ${balance.available} ${balance.name} day(s) available` +
      (balance.pending_days ? ` (${balance.pending_days} pending)` : '') +
      `; this request needs ${days}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, days, reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, leave_type_id, start_date, end_date, days, reason || null]);
  res.status(201).json(rows[0]);
});

// One endpoint, three actions — the Phase 2 state machine:
//   approve: PENDING -> APPROVED, and the days move into leave_balances.used_days
//   reject:  PENDING -> REJECTED  (the pending reservation simply stops counting)
//   cancel:  PENDING -> CANCELLED, owner only
router.patch('/:id', async (req, res) => {
  const { action } = req.body || {};
  const actor = Number(action === 'cancel' ? req.body?.user_id : req.body?.decided_by); // TEMP until Part C
  if (!['approve', 'reject', 'cancel'].includes(action)) {
    throw httpError(400, 'VALIDATION_ERROR', 'action must be "approve", "reject" or "cancel"');
  }
  if (!actor) {
    throw httpError(400, 'VALIDATION_ERROR',
      action === 'cancel' ? 'user_id is required' : 'decided_by is required');
  }
  const found = await pool.query('SELECT * FROM leave_requests WHERE id = $1', [req.params.id]);
  if (!found.rowCount) throw httpError(404, 'NOT_FOUND', 'no such leave request');
  const request = found.rows[0];

  if (action === 'cancel' && actor !== request.user_id) {
    throw httpError(403, 'FORBIDDEN', 'only the owner can cancel a request');
  }
  if (action !== 'cancel' && actor === request.user_id) {
    throw httpError(403, 'FORBIDDEN', 'you cannot decide your own request');
  }
  if (request.status !== 'PENDING') {
    throw httpError(409, 'INVALID_STATE',
      `cannot ${action} a request that is already ${request.status}`);
  }

  if (action !== 'approve') {
    // One row changes — no transaction needed. `AND status = 'PENDING'` guards the
    // race where someone else decided it between our SELECT and this UPDATE.
    const upd = await pool.query(
      action === 'cancel'
        ? `UPDATE leave_requests SET status = 'CANCELLED'
            WHERE id = $1 AND status = 'PENDING' RETURNING *`
        : `UPDATE leave_requests SET status = 'REJECTED', decided_by = $2, decided_at = now()
            WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      action === 'cancel' ? [request.id] : [request.id, actor]);
    if (!upd.rowCount) throw httpError(409, 'INVALID_STATE', 'request is no longer PENDING');
    return res.json(upd.rows[0]);
  }

  // Approve touches two tables that must agree, so both writes share one
  // transaction on one connection: both land, or neither does.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE leave_requests SET status = 'APPROVED', decided_by = $2, decided_at = now()
        WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [request.id, actor]);
    if (!upd.rowCount) throw httpError(409, 'INVALID_STATE', 'request is no longer PENDING');
    const r = upd.rows[0];
    await client.query(
      `INSERT INTO leave_balances (user_id, leave_type_id, year, used_days)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, leave_type_id, year)
       DO UPDATE SET used_days = leave_balances.used_days + EXCLUDED.used_days`,
      [r.user_id, r.leave_type_id, Number(r.start_date.slice(0, 4)), r.days]);
    await client.query('COMMIT');
    res.json(r);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always — a leaked client drains the pool
  }
});

module.exports = router;
