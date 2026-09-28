// Dates travel as 'YYYY-MM-DD' strings. All arithmetic is done in UTC so the
// server's timezone (UTC+5:30 here, UTC in the cloud) can never shift a day.

const toUtc = (iso) => new Date(iso + 'T00:00:00Z');

// A real calendar date in YYYY-MM-DD form ('2026-02-30' is rejected).
function isDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = toUtc(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Calendar days from start to end, both inclusive.
function calendarDays(start, end) {
  return (toUtc(end) - toUtc(start)) / 86400000 + 1;
}

// Working days (Mon–Fri) from start to end, both inclusive.
// Public holidays are not excluded yet — open question Q3 / risk R3 in docs/design.md.
function leaveDays(start, end) {
  let days = 0;
  for (const d = toUtc(start); d <= toUtc(end); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
}

module.exports = { isDate, calendarDays, leaveDays };
