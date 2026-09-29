const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// The manager's approval inbox: PENDING requests from direct reports.
// HR_ADMIN sees every PENDING request (US-9, and design D9).
// also_off (US-14): the requester's teammates (same manager) with an APPROVED or
// PENDING request overlapping these dates — so nobody approves the team into short staffing.
router.get('/requests', requireAuth, requireRole('MANAGER', 'HR_ADMIN'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT lr.*, u.name AS employee_name, lt.name AS leave_type,
            COALESCE((
              SELECT json_agg(json_build_object('name', ou.name, 'start_date', o.start_date,
                                                'end_date', o.end_date, 'status', o.status)
                              ORDER BY o.start_date)
                FROM leave_requests o
                JOIN users ou ON ou.id = o.user_id
               WHERE ou.manager_id = u.manager_id AND o.user_id <> lr.user_id
                 AND o.status IN ('APPROVED', 'PENDING')
                 AND o.start_date <= lr.end_date AND o.end_date >= lr.start_date
            ), '[]') AS also_off
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
