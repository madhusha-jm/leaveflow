const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const httpError = require('../lib/httpError');
const { jwtSecret, jwtExpiresIn } = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Compared against when the email is unknown, so a wrong email takes as long as
// a wrong password — response time can't reveal which addresses exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw httpError(400, 'VALIDATION_ERROR', 'email and password are required');
  }
  const { rows } = await pool.query(
    'SELECT id, name, role, password_hash FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  // Same 401 for "no such email" and "wrong password".
  if (!user || !ok) throw httpError(401, 'BAD_CREDENTIALS', 'wrong email or password');

  const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret,
    { algorithm: 'HS256', expiresIn: jwtExpiresIn });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role, manager_id FROM users WHERE id = $1', [req.user.id]);
  if (!rows.length) throw httpError(401, 'BAD_TOKEN', 'this account no longer exists');
  res.json(rows[0]);
});

module.exports = router;
