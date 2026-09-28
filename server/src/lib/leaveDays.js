// Working days between two dates, inclusive: weekends and public holidays excluded.
// Pure — same inputs, same output, no database, no clock — so it is unit-tested
// in tests/leaveDays.test.js. All arithmetic is in UTC so the server's timezone
// (UTC+5:30 here, UTC in the cloud) can never shift a day.
// holidays: array of 'YYYY-MM-DD' strings (poya days etc.).
function leaveDays(startDate, endDate, holidays = []) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid date');
  }
  if (end < start) {
    throw new Error('end_date must not be before start_date');
  }
  const skip = new Set(holidays);
  let days = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dow = cursor.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dow !== 0 && dow !== 6 && !skip.has(cursor.toISOString().slice(0, 10))) {
      days += 1;
    }
  }
  return days;
}

module.exports = { leaveDays };
