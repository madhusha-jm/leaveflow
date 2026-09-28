const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// The manager's approval inbox: PENDING requests from direct reports.
// HR_ADMIN sees every PENDING request (US-9, and design D9).
router.get('/requests', requireAuth, requireRole('MANAGER', 'HR_ADMIN'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT lr.*, u.name AS employee_name, lt.name AS leave_type
       FROM leave_requests lr
       JOIN users u        ON u.id = lr.user_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status = 'PENDING'
        AND lr.user_id <> $1
        AND (u.manager_id = $1 OR $2 = 'HR_ADMIN')
      ORDER BY lr.start_date, lr.id`,
    [req.user.id, req.user.role]);
  res.json(rows);
});

module.exports = router;
