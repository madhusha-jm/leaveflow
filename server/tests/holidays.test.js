// Capstone US-17/18: the holiday calendar HR edits, and how it drives the day count.
const { pool, ANNUAL, as, apply } = require('./setup');
const { leaveDays } = require('../src/lib/leaveDays');
const { holidaysBetween, missingYears } = require('../src/lib/holidays');

const DURUTHU = { date: '2027-01-21', name: 'Duruthu Full Moon Poya' }; // a Thursday

describe('holidaysBetween (reads the holidays table)', () => {
  test('includes Vesak 2026, so the routes exclude it', async () => {
    expect(await holidaysBetween(pool, '2026-04-29', '2026-05-04')).toContain('2026-05-01');
  });

  test('refuses a year with no holidays instead of returning none (issue #26)', async () => {
    await expect(holidaysBetween(pool, '2030-03-04', '2030-03-08'))
      .rejects.toThrow('public holidays for 2030 are not loaded');
  });

  test('refuses a range that reaches into a year with no holidays', async () => {
    await expect(holidaysBetween(pool, '2026-12-28', '2027-01-05'))
      .rejects.toThrow('public holidays for 2027');
  });

  test('the Vesak week really is 3 working days end to end (US-18)', async () => {
    const [start, end] = ['2026-04-29', '2026-05-04'];
    expect(leaveDays(start, end, await holidaysBetween(pool, start, end))).toBe(3);
  });

  test('missingYears names the years HR still has to load', async () => {
    expect(await missingYears(pool, [2026, 2027])).toEqual([2027]);
  });
});

describe('GET /api/holidays', () => {
  test('anyone logged in can read a year, sorted by date', async () => {
    const res = await as('ishara').get('/api/holidays?year=2026');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(16);
    expect(res.body[0]).toEqual({ date: '2026-01-15', name: 'Tamil Thai Pongal' });
    expect(res.body.map((h) => h.date)).toEqual([...res.body.map((h) => h.date)].sort());
  });

  test('an empty year is an empty list', async () => {
    const res = await as('ishara').get('/api/holidays?year=2030');
    expect(res.body).toEqual([]);
  });

  test('a missing or silly year is 400', async () => {
    expect((await as('ishara').get('/api/holidays')).status).toBe(400);
    expect((await as('ishara').get('/api/holidays?year=abc')).status).toBe(400);
  });
});

describe('POST /api/holidays (US-17)', () => {
  test('HR adds a holiday and it appears in that year', async () => {
    const res = await as('dilini').post('/api/holidays', DURUTHU);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(DURUTHU);
    const list = await as('ishara').get('/api/holidays?year=2027');
    expect(list.body).toEqual([DURUTHU]);
  });

  test('once HR adds 2027, employees can book leave in 2027 — and the holiday is not charged', async () => {
    const before = await as('ishara').post('/api/leave-requests',
      { leave_type_id: ANNUAL, start_date: '2027-01-20', end_date: '2027-01-22' });
    expect(before.status).toBe(409);
    expect(before.body.error.code).toBe('HOLIDAYS_NOT_LOADED');

    await as('dilini').post('/api/holidays', DURUTHU);
    const after = await apply('ishara', { start_date: '2027-01-20', end_date: '2027-01-22' });
    expect(after.days).toBe(2); // Wed + Fri; Thu 21 is Duruthu Poya
  });

  test('the same date twice is 409 DUPLICATE_HOLIDAY', async () => {
    await as('dilini').post('/api/holidays', DURUTHU);
    const res = await as('dilini').post('/api/holidays', { ...DURUTHU, name: 'again' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_HOLIDAY');
  });

  test('employees and managers get 403', async () => {
    expect((await as('ishara').post('/api/holidays', DURUTHU)).status).toBe(403);
    expect((await as('ruwan').post('/api/holidays', DURUTHU)).status).toBe(403);
  });

  test('a bad date or an empty name is 400', async () => {
    expect((await as('dilini').post('/api/holidays', { date: '2027-02-30', name: 'x' })).status).toBe(400);
    expect((await as('dilini').post('/api/holidays', { date: '2027-02-01', name: '   ' })).status).toBe(400);
    expect((await as('dilini').post('/api/holidays', { date: '2027-02-01', name: 'x'.repeat(101) })).status).toBe(400);
  });
});

describe('DELETE /api/holidays/:date', () => {
  test('HR removes a holiday', async () => {
    await as('dilini').post('/api/holidays', DURUTHU);
    const res = await as('dilini').delete(`/api/holidays/${DURUTHU.date}`);
    expect(res.status).toBe(204);
    expect((await as('ishara').get('/api/holidays?year=2027')).body).toEqual([]);
  });

  test('a date that is not a holiday is 404; employees get 403', async () => {
    expect((await as('dilini').delete('/api/holidays/2027-03-01')).status).toBe(404);
    expect((await as('ishara').delete('/api/holidays/2026-05-01')).status).toBe(403);
  });

  test('changing holidays never rewrites an existing request (design D14)', async () => {
    await as('dilini').post('/api/holidays', DURUTHU);
    const req = await apply('ishara', { start_date: '2027-01-20', end_date: '2027-01-22' }); // 2 days
    await as('dilini').post('/api/holidays', { date: '2027-01-02', name: 'keep 2027 loaded' });
    await as('dilini').delete(`/api/holidays/${DURUTHU.date}`);
    const mine = await as('ishara').get('/api/leave-requests');
    expect(mine.body.find((r) => r.id === req.id).days).toBe(2);
  });
});
