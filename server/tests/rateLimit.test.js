// Its own file on purpose: Jest gives each file a fresh copy of the app, so this
// file's failed logins can't make other files' login tests hit the limit.
const { request, app } = require('./setup');

const badLogin = () => request(app).post('/api/auth/login')
  .send({ email: 'ishara@ceylonroots.lk', password: 'wrong' });

test('the 11th failed login in 15 minutes gets 429', async () => {
  for (let i = 1; i <= 10; i++) {
    expect((await badLogin()).status).toBe(401);
  }
  const res = await badLogin();
  expect(res.status).toBe(429);
  expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
});
