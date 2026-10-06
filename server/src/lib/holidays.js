// Public holidays — they don't count as leave days. Since the capstone they live in
// the `holidays` table, which HR edits in the app (US-17, design D13), instead of in
// code that only a developer could change (issue #26).
// db: the shared pool, or a transaction's client.
const httpError = require('./httpError');

const yearOf = (iso) => Number(iso.slice(0, 4));
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

async function datesInYears(db, years) {
  const { rows } = await db.query(
    `SELECT date FROM holidays WHERE EXTRACT(YEAR FROM date)::int = ANY($1::int[])`, [years]);
  return rows.map((r) => r.date); // 'YYYY-MM-DD' strings (see db/pool.js)
}

// Years (of those given) with no holidays at all — server.js warns about these at startup.
async function missingYears(db, years) {
  const present = new Set((await datesInYears(db, years)).map(yearOf));
  return years.filter((y) => !present.has(y));
}

// All holiday dates in the years a date range touches.
// A year with no holidays is an error, not an empty list: silently treating every
// poya day as a working day would miscount leave without anyone noticing (#26).
async function holidaysBetween(db, startDate, endDate) {
  const years = range(yearOf(startDate), yearOf(endDate));
  const dates = await datesInYears(db, years);
  const present = new Set(dates.map(yearOf));
  const missing = years.find((y) => !present.has(y));
  if (missing) {
    throw httpError(409, 'HOLIDAYS_NOT_LOADED',
      `public holidays for ${missing} are not loaded yet — HR must add them before leave in ${missing} can be booked`);
  }
  return dates;
}

module.exports = { holidaysBetween, missingYears };
