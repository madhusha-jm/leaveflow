// Shared by the API test files: a clean database before EVERY test, and helpers.
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/db/pool');

beforeEach(async () => {
  await pool.query('TRUNCATE leave_requests, leave_balances RESTART IDENTITY CASCADE');
  // users and leave_types are seeded by the migrations, not truncated: every
  // test relies on the same Ishara / Ruwan / Dilini / Kasun / Nimali fixtures.
});

afterAll(async () => {
  await pool.end();
});

// Seeded users (all password123). Ruwan manages Ishara; Kasun manages Nimali.
const USERS = {
  ruwan: 'ruwan@ceylonroots.lk', // MANAGER
  ishara: 'ishara@ceylonroots.lk', // EMPLOYEE, reports to Ruwan
  dilini: 'dilini@ceylonroots.lk', // HR_ADMIN
  kasun: 'kasun@ceylonroots.lk', // MANAGER
  nimali: 'nimali@ceylonroots.lk', // EMPLOYEE, reports to Kasun
};
const ANNUAL = 1; // leave_types seed: 1 Annual (14), 2 Casual (7), 3 Sick (7)
const SICK = 3;

// Logging in costs a bcrypt hash (~70 ms), so each test file logs in once per user.
const tokens = {};
async function loginAs(name) {
  if (!tokens[name]) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USERS[name], password: 'password123' });
    if (res.status !== 200) throw new Error(`login as ${name} failed: ${res.status}`);
    tokens[name] = res.body.token;
  }
  return tokens[name];
}

// await as('ishara').post('/api/leave-requests', {...}) — a request with her token.
async function call(name, method, url, body) {
  const req = request(app)[method](url).set('Authorization', `Bearer ${await loginAs(name)}`);
  return body === undefined ? req : req.send(body);
}
function as(name) {
  return {
    get: (url) => call(name, 'get', url),
    post: (url, body) => call(name, 'post', url, body),
    patch: (url, body) => call(name, 'patch', url, body),
  };
}

// Applies for Mon 9 – Fri 13 March 2026 — 5 working days, no holidays — unless told otherwise.
// (Not 2–6 March: Tue 3 March is Medin Poya, so that week is only 4 days.)
async function apply(name = 'ishara', overrides = {}) {
  const res = await as(name).post('/api/leave-requests', {
    leave_type_id: ANNUAL, start_date: '2026-03-09', end_date: '2026-03-13', reason: 'Family trip',
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`apply failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

module.exports = { request, app, pool, USERS, ANNUAL, SICK, loginAs, as, apply };
