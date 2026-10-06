const express = require('express');
const pool = require('../db/pool');
const httpError = require('../lib/httpError');
const { isDate } = require('../lib/dates');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const MAX_NAME_LENGTH = 100;

// The holiday calendar (US-17). Everyone may read it, so the apply form can show
// "1 May is Vesak" before submitting; only HR changes it (design D15).
// GET /api/holidays?year=2027
router.get('/', async (req, res) => {
  const year = Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw httpError(400, 'VALIDATION_ERROR', 'year must be a year like 2027');
  }
  const { rows } = await pool.query(
    `SELECT date, name FROM holidays
      WHERE date BETWEEN make_date($1, 1, 1) AND make_date($1, 12, 31)
      ORDER BY date`, [year]);
  res.json(rows);
});

// POST /api/holidays { "date": "2027-01-02", "name": "Duruthu Poya" }
router.post('/', requireRole('HR_ADMIN'), async (req, res) => {
  const { date, name } = req.body || {};
  if (!isDate(date)) throw httpError(400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(400, 'VALIDATION_ERROR', `name is required, at most ${MAX_NAME_LENGTH} characters`);
  }
  // Insert-or-nothing instead of check-then-insert: the primary key settles a race
  // between two HR tabs adding the same date.
  const { rows } = await pool.query(
    `INSERT INTO holidays (date, name, created_by) VALUES ($1, $2, $3)
     ON CONFLICT (date) DO NOTHING
     RETURNING date, name`, [date, trimmed, req.user.id]);
  if (!rows.length) throw httpError(409, 'DUPLICATE_HOLIDAY', `${date} is already a holiday`);
  res.status(201).json(rows[0]);
});

// DELETE /api/holidays/2027-01-02 — existing requests keep their day count (design D14).
router.delete('/:date', requireRole('HR_ADMIN'), async (req, res) => {
  if (!isDate(req.params.date)) throw httpError(400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  const { rowCount } = await pool.query('DELETE FROM holidays WHERE date = $1', [req.params.date]);
  if (!rowCount) throw httpError(404, 'NOT_FOUND', `${req.params.date} is not a holiday`);
  res.status(204).end();
});

module.exports = router;
