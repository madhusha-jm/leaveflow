const express = require('express');
const pool = require('../db/pool');
const httpError = require('../lib/httpError');
const { getBalances } = require('../lib/balances');

const router = express.Router();

// GET /api/balances?user_id=2[&year=2026]
// Rendered by the UI as "Annual: 8 available (2 pending)" (US-3).
router.get('/', async (req, res) => {
  const userId = Number(req.query.user_id); // TEMP — Part C takes this from the JWT
  if (!userId) throw httpError(400, 'VALIDATION_ERROR', 'user_id is required');
  const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year);
  if (!Number.isInteger(year)) throw httpError(400, 'VALIDATION_ERROR', 'year must be a number');
  res.json(await getBalances(pool, userId, year));
});

module.exports = router;
