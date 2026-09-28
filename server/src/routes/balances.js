const express = require('express');
const pool = require('../db/pool');
const httpError = require('../lib/httpError');
const { getBalances } = require('../lib/balances');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/balances[?year=2026]            → my balances
// GET /api/balances?user_id=2[&year=2026]  → a direct report's (manager) or anyone's (HR),
//                                            so an approver sees what a decision will leave (US-4)
// Rendered by the UI as "Annual: 8 available (2 pending)" (US-3).
router.get('/', async (req, res) => {
  const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year);
  if (!Number.isInteger(year)) throw httpError(400, 'VALIDATION_ERROR', 'year must be a number');

  let userId = req.user.id;
  if (req.query.user_id !== undefined && Number(req.query.user_id) !== req.user.id) {
    userId = Number(req.query.user_id);
    if (!Number.isInteger(userId)) throw httpError(400, 'VALIDATION_ERROR', 'user_id must be a number');
    const { rows } = await pool.query('SELECT manager_id FROM users WHERE id = $1', [userId]);
    if (!rows.length) throw httpError(404, 'NOT_FOUND', 'no such user');
    if (req.user.role !== 'HR_ADMIN' && rows[0].manager_id !== req.user.id) {
      throw httpError(403, 'FORBIDDEN', 'you can only see your own or your reports\' balances');
    }
  }
  res.json(await getBalances(pool, userId, year));
});

module.exports = router;
