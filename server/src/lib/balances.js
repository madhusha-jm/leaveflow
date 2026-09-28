// available = allocation − approved − pending   (docs/design.md, D3)
// approved comes from leave_balances.used_days (written only by approve);
// pending is summed live from PENDING requests, so cancel/reject need no update.
//
// `db` is the pool or a transaction client — both have .query().
async function getBalances(db, userId, year) {
  const { rows } = await db.query(
    `SELECT lt.id AS leave_type_id, lt.name, lt.annual_allocation AS allocation,
            COALESCE(lb.used_days, 0) AS approved_days,
            COALESCE(p.pending, 0)    AS pending_days
       FROM leave_types lt
       LEFT JOIN leave_balances lb
              ON lb.leave_type_id = lt.id AND lb.user_id = $1 AND lb.year = $2
       LEFT JOIN (SELECT leave_type_id, SUM(days) AS pending
                    FROM leave_requests
                   WHERE user_id = $1 AND status = 'PENDING'
                     AND EXTRACT(YEAR FROM start_date) = $2
                   GROUP BY leave_type_id) p
              ON p.leave_type_id = lt.id
      ORDER BY lt.id`,
    [userId, year]
  );
  return rows.map((r) => ({
    ...r,
    available: r.allocation - r.approved_days - r.pending_days,
  }));
}

module.exports = { getBalances };
