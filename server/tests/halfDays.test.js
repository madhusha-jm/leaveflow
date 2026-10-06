// Capstone US-15/16: half-day leave — MORNING or AFTERNOON on one date, costing 0.5.
const { ANNUAL, SICK, as, apply } = require('./setup');

const MON = '2026-03-09'; // an ordinary Monday — no holiday
const half = (part, date = MON, extra = {}) =>
  ({ leave_type_id: ANNUAL, start_date: date, end_date: date, day_part: part, ...extra });
const annualOf = async (name) =>
  (await as(name).get('/api/balances?year=2026')).body.find((b) => b.leave_type_id === ANNUAL);

describe('booking a half day (US-15)', () => {
  test('a MORNING is saved as PENDING, 0.5 days, part MORNING', async () => {
    const res = await as('ishara').post('/api/leave-requests', half('MORNING'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', days: 0.5, day_part: 'MORNING' });
  });

  test('a full-day request is still FULL by default', async () => {
    const created = await apply('ishara');
    expect(created).toMatchObject({ day_part: 'FULL', days: 5 });
  });

  test("the manager's inbox shows which half", async () => {
    await as('ishara').post('/api/leave-requests', half('AFTERNOON'));
    const inbox = await as('ruwan').get('/api/team/requests');
    expect(inbox.body[0]).toMatchObject({ day_part: 'AFTERNOON', days: 0.5 });
  });

  test('a half day across two dates is 400', async () => {
    const res = await as('ishara').post('/api/leave-requests',
      { ...half('MORNING'), end_date: '2026-03-10' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/half day is a single date/);
  });

  test('an unknown day_part is 400', async () => {
    const res = await as('ishara').post('/api/leave-requests', half('EVENING'));
    expect(res.status).toBe(400);
  });

  test('a half day on a public holiday or a weekend is 400 (US-18)', async () => {
    const vesak = await as('ishara').post('/api/leave-requests', half('MORNING', '2026-05-01'));
    const saturday = await as('ishara').post('/api/leave-requests', half('MORNING', '2026-03-07'));
    expect(vesak.status).toBe(400);
    expect(vesak.body.error.message).toMatch(/weekend or a public holiday/);
    expect(saturday.status).toBe(400);
  });
});

describe('half days and overlap (design D12)', () => {
  test('a MORNING and an AFTERNOON on the same date are both allowed', async () => {
    await as('ishara').post('/api/leave-requests', half('MORNING'));
    const res = await as('ishara').post('/api/leave-requests', half('AFTERNOON'));
    expect(res.status).toBe(201);
  });

  test('the same half twice is 409', async () => {
    await as('ishara').post('/api/leave-requests', half('MORNING'));
    const res = await as('ishara').post('/api/leave-requests', half('MORNING'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERLAPPING_REQUEST');
    expect(res.body.error.message).toMatch(/morning/);
  });

  test('a half day inside a full-day request is 409, and the other way round', async () => {
    await apply('ishara'); // Mon 9 – Fri 13 March
    const inside = await as('ishara').post('/api/leave-requests', half('AFTERNOON', '2026-03-11'));
    expect(inside.status).toBe(409);

    await as('nimali').post('/api/leave-requests', half('MORNING'));
    const around = await as('nimali').post('/api/leave-requests',
      { leave_type_id: ANNUAL, start_date: MON, end_date: '2026-03-10' });
    expect(around.status).toBe(409);
  });

  test('a cancelled half day no longer blocks the date', async () => {
    const first = await as('ishara').post('/api/leave-requests', half('MORNING'));
    await as('ishara').patch(`/api/leave-requests/${first.body.id}`, { action: 'cancel' });
    const again = await as('ishara').post('/api/leave-requests', half('MORNING'));
    expect(again.status).toBe(201);
  });
});

describe('half-day balance maths (US-16)', () => {
  test('PENDING: 0.5 pending, 13.5 available', async () => {
    await as('ishara').post('/api/leave-requests', half('MORNING'));
    expect(await annualOf('ishara')).toMatchObject({ pending_days: 0.5, available: 13.5 });
  });

  test('APPROVED: 0.5 used, 13.5 available', async () => {
    const { body } = await as('ishara').post('/api/leave-requests', half('MORNING'));
    await as('ruwan').patch(`/api/leave-requests/${body.id}`, { action: 'approve' });
    expect(await annualOf('ishara')).toMatchObject({ approved_days: 0.5, pending_days: 0, available: 13.5 });
  });

  test('two halves make a whole day', async () => {
    await as('ishara').post('/api/leave-requests', half('MORNING'));
    await as('ishara').post('/api/leave-requests', half('AFTERNOON'));
    expect(await annualOf('ishara')).toMatchObject({ pending_days: 1, available: 13 });
  });

  test('allowed with exactly 0.5 left, refused with 0 left', async () => {
    // Sick has 7: 5 (Mon 9 – Fri 13) + 1 (Mon 16) + 0.5 (Tue 17 morning) = 6.5 → 0.5 left.
    await apply('ishara', { leave_type_id: SICK });
    await apply('ishara', { leave_type_id: SICK, start_date: '2026-03-16', end_date: '2026-03-16' });
    await apply('ishara', half('MORNING', '2026-03-17', { leave_type_id: SICK }));

    const last = await as('ishara').post('/api/leave-requests',
      half('MORNING', '2026-03-18', { leave_type_id: SICK }));
    expect(last.status).toBe(201); // exactly 0.5 left — allowed

    const tooMany = await as('ishara').post('/api/leave-requests',
      half('MORNING', '2026-03-19', { leave_type_id: SICK }));
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });
});
