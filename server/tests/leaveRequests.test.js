const { request, app, ANNUAL, SICK, as, apply } = require('./setup');

describe('POST /api/leave-requests', () => {
  test('creates a PENDING request for a valid submission', async () => {
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: ANNUAL, start_date: '2026-03-09', end_date: '2026-03-13', reason: 'Family trip',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.days).toBe(5);
  });

  test('excludes a poya day: Mon 2 – Fri 6 March (Medin Poya on Tue 3) is 4 days', async () => {
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: ANNUAL, start_date: '2026-03-02', end_date: '2026-03-06',
    });
    expect(res.status).toBe(201);
    expect(res.body.days).toBe(4);
  });

  test('rejects end_date before start_date with 400', async () => {
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: ANNUAL, start_date: '2026-03-06', end_date: '2026-03-02', reason: 'Oops',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a missing token with 401', async () => {
    const res = await request(app).post('/api/leave-requests').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_TOKEN');
  });

  test('rejects a weekend-only range with 400', async () => {
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: ANNUAL, start_date: '2026-03-14', end_date: '2026-03-15',
    });
    expect(res.status).toBe(400);
  });

  test('rejects a request that overlaps a PENDING one with 409', async () => {
    await apply('ishara'); // 9–13 March
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: ANNUAL, start_date: '2026-03-12', end_date: '2026-03-17',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERLAPPING_REQUEST');
  });

  test('rejects more days than the balance allows with 409', async () => {
    // Sick allocation is 7; Mon 9 – Wed 18 March is 8 working days.
    const res = await as('ishara').post('/api/leave-requests', {
      leave_type_id: SICK, start_date: '2026-03-09', end_date: '2026-03-18',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  test('ignores a user_id in the body — the request belongs to the token owner', async () => {
    const res = await as('ishara').post('/api/leave-requests', {
      user_id: 5, leave_type_id: ANNUAL, start_date: '2026-03-09', end_date: '2026-03-09',
    });
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(2); // Ishara, not Nimali
  });
});

describe('PATCH /api/leave-requests/:id — approve and reject', () => {
  test('forbids an EMPLOYEE approving her own request with 403', async () => {
    const lr = await apply('ishara');
    const res = await as('ishara').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    expect(res.status).toBe(403);
  });

  test("lets the requester's manager approve", async () => {
    const lr = await apply('ishara');
    const res = await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.decided_by).toBe(1); // Ruwan, taken from the token
  });

  test("Nadeesha's demo: approving 5 of 14 Annual days leaves 9", async () => {
    const lr = await apply('ishara'); // 5 days
    await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    const res = await as('ishara').get('/api/balances?year=2026');
    const annual = res.body.find((b) => b.leave_type_id === ANNUAL);
    expect(annual).toMatchObject({ allocation: 14, approved_days: 5, pending_days: 0, available: 9 });
  });

  test("forbids another team's manager with 403", async () => {
    const lr = await apply('ishara');
    const res = await as('kasun').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    expect(res.status).toBe(403);
  });

  test('lets HR approve anyone', async () => {
    const lr = await apply('nimali');
    const res = await as('dilini').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    expect(res.status).toBe(200);
  });

  test('refuses to approve the same request twice with 409', async () => {
    const lr = await apply('ishara');
    await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    const res = await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('rejecting releases the pending days back to the balance', async () => {
    const lr = await apply('ishara');
    const res = await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'reject' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    const bal = await as('ishara').get('/api/balances?year=2026');
    expect(bal.body.find((b) => b.leave_type_id === ANNUAL).available).toBe(14);
  });

  test('returns 404 for a request that does not exist', async () => {
    const res = await as('ruwan').patch('/api/leave-requests/9999', { action: 'approve' });
    expect(res.status).toBe(404);
  });

  test('rejects an unknown action with 400', async () => {
    const lr = await apply('ishara');
    const res = await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'delete' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/leave-requests/:id — cancel', () => {
  test('owner cancels a PENDING request (200, CANCELLED)', async () => {
    const lr = await apply('ishara');
    const res = await as('ishara').patch(`/api/leave-requests/${lr.id}`, { action: 'cancel' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  test('cancelling an APPROVED request is refused with 409', async () => {
    const lr = await apply('ishara');
    await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'approve' });
    const res = await as('ishara').patch(`/api/leave-requests/${lr.id}`, { action: 'cancel' });
    expect(res.status).toBe(409);
  });

  test("cancelling someone else's request is forbidden with 403 — even for their manager", async () => {
    const lr = await apply('ishara');
    const res = await as('ruwan').patch(`/api/leave-requests/${lr.id}`, { action: 'cancel' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/leave-requests', () => {
  test('an employee sees only her own requests', async () => {
    await apply('ishara');
    await apply('nimali');
    const res = await as('ishara').get('/api/leave-requests');
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.user_id)).toEqual([2]);
  });

  test('HR sees everyone', async () => {
    await apply('ishara');
    await apply('nimali');
    const res = await as('dilini').get('/api/leave-requests');
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    const lr = await apply('ishara');
    await apply('ishara', { start_date: '2026-03-16', end_date: '2026-03-16' });
    await as('ishara').patch(`/api/leave-requests/${lr.id}`, { action: 'cancel' });
    const res = await as('ishara').get('/api/leave-requests?status=PENDING');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].start_date).toBe('2026-03-16');
  });
});

describe('POST /api/leave-requests — requests arriving at the same moment', () => {
  // Issue #23 (BUG-01): five 2-day Sick requests (10 days) against a balance of 7, all at once.
  // Only three fit (6 days); the other two must be refused — never a negative balance.
  test('requests sent together cannot overspend the balance', async () => {
    const weeks = [ // Mon–Tue pairs, 2 working days each, no holidays
      ['2026-03-09', '2026-03-10'], ['2026-03-16', '2026-03-17'], ['2026-03-23', '2026-03-24'],
      ['2026-03-30', '2026-03-31'], ['2026-04-06', '2026-04-07'],
    ];
    const results = await Promise.all(weeks.map(([start_date, end_date]) =>
      as('ishara').post('/api/leave-requests', { leave_type_id: SICK, start_date, end_date })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const bal = await as('ishara').get('/api/balances?year=2026');
    expect(bal.body.find((b) => b.leave_type_id === SICK).available).toBe(1);
  });

  // Issue #24 (BUG-02): the same request from two tabs.
  test('the same request sent twice is only created once', async () => {
    const body = { leave_type_id: ANNUAL, start_date: '2026-03-09', end_date: '2026-03-10' };
    const results = await Promise.all([
      as('ishara').post('/api/leave-requests', body),
      as('ishara').post('/api/leave-requests', body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const list = await as('ishara').get('/api/leave-requests');
    expect(list.body).toHaveLength(1);
  });
});
