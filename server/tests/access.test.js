// Login, tokens, balances visibility and the approval inbox.
const { request, app, ANNUAL, as, apply } = require('./setup');

describe('auth', () => {
  test('login returns a token and the user', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'Ishara@CeylonRoots.lk', password: 'password123' }); // case-insensitive
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 2, name: 'Ishara Fernando', role: 'EMPLOYEE' });
  });

  test('a wrong password and an unknown email get the same 401', async () => {
    const wrongPw = await request(app).post('/api/auth/login')
      .send({ email: 'ishara@ceylonroots.lk', password: 'nope' });
    const noUser = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@ceylonroots.lk', password: 'nope' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body).toEqual(noUser.body); // no hint about which emails exist
  });

  test('GET /me with a forged token is 401', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('BAD_TOKEN');
  });

  test('GET /me with a valid token returns the profile', async () => {
    const res = await as('ruwan').get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, role: 'MANAGER', manager_id: null });
  });
});

describe('GET /api/balances', () => {
  test('a PENDING request reserves its days', async () => {
    await apply('ishara'); // 5 days
    const res = await as('ishara').get('/api/balances?year=2026');
    const annual = res.body.find((b) => b.leave_type_id === ANNUAL);
    expect(annual).toMatchObject({ allocation: 14, pending_days: 5, available: 9 });
  });

  test("a manager can see a direct report's balances", async () => {
    const res = await as('ruwan').get('/api/balances?user_id=2');
    expect(res.status).toBe(200);
  });

  test("a manager cannot see another team's balances (403)", async () => {
    const res = await as('ruwan').get('/api/balances?user_id=5');
    expect(res.status).toBe(403);
  });

  test("an employee cannot see a colleague's balances (403)", async () => {
    const res = await as('ishara').get('/api/balances?user_id=5');
    expect(res.status).toBe(403);
  });

  test('HR can see anyone', async () => {
    const res = await as('dilini').get('/api/balances?user_id=5');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/team/requests', () => {
  test("a manager's inbox holds only their team's PENDING requests", async () => {
    await apply('ishara');
    await apply('nimali');
    const res = await as('ruwan').get('/api/team/requests');
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.employee_name)).toEqual(['Ishara Fernando']);
  });

  test("HR's inbox holds everyone's", async () => {
    await apply('ishara');
    await apply('nimali');
    const res = await as('dilini').get('/api/team/requests');
    expect(res.body).toHaveLength(2);
  });

  test('an employee has no inbox (403)', async () => {
    const res = await as('ishara').get('/api/team/requests');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/health', () => {
  test('reports the API and database as ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });
});

describe('US-14: who else on the team is off', () => {
  test("shows an overlapping teammate's approved leave", async () => {
    const sahan = await apply('sahan', { start_date: '2026-03-11', end_date: '2026-03-12' });
    await as('ruwan').patch(`/api/leave-requests/${sahan.id}`, { action: 'approve' });
    await apply('ishara'); // 9–13 March
    const res = await as('ruwan').get('/api/team/requests');
    const ishara = res.body.find((r) => r.employee_name === 'Ishara Fernando');
    expect(ishara.also_off).toEqual([
      { name: 'Sahan Wickramasinghe', start_date: '2026-03-11', end_date: '2026-03-12', status: 'APPROVED' },
    ]);
  });

  test('leaves out non-overlapping, cancelled and other-team leave', async () => {
    await apply('sahan', { start_date: '2026-03-16', end_date: '2026-03-17' }); // after Ishara's week
    const cancelled = await apply('sahan', { start_date: '2026-03-09', end_date: '2026-03-09' });
    await as('sahan').patch(`/api/leave-requests/${cancelled.id}`, { action: 'cancel' });
    await apply('nimali'); // same week, but Kasun's team
    await apply('ishara');
    const res = await as('ruwan').get('/api/team/requests');
    const ishara = res.body.find((r) => r.employee_name === 'Ishara Fernando');
    expect(ishara.also_off).toEqual([]);
  });
});
