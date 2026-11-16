import request from 'supertest';
import { app } from '../app';
import { auth } from '../auth';

const DAY = 86_400_000;
let students = 0;
async function signedUp() {
  return request(app).post('/api/auth/sign-up/email').send({
    name: 'Test Student', email: `renew${++students}@example.edu`, password: 'test-password-1',
  });
}

afterEach(() => jest.restoreAllMocks());

it('passes the renewed cookie and extends an aged session on an ordinary request', async () => {
  const up = await signedUp();
  expect(up.status).toBe(200);
  const oldExpiry = new Date(Date.now() + 28 * DAY);
  const context = await auth.$context;
  await context.internalAdapter.updateSession(up.body.token, {
    expiresAt: oldExpiry, updatedAt: new Date(Date.now() - 2 * DAY),
  });
  const response = await request(app).get('/semester').set('Cookie', up.headers['set-cookie']);
  expect(response.status).toBe(200);
  expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
    expect.stringMatching(/session_token=.*Max-Age=2592000/i),
  ]));
  const renewed = await context.internalAdapter.findSession(up.body.token);
  expect(renewed!.session.expiresAt.getTime()).toBeGreaterThan(oldExpiry.getTime() + DAY);
});

it('preserves every Set-Cookie returned by the session check', async () => {
  const headers = new Headers();
  headers.append('set-cookie', 'first=one; Path=/; HttpOnly');
  headers.append('set-cookie', 'second=two; Path=/; HttpOnly');
  jest.spyOn(auth.api, 'getSession').mockResolvedValueOnce({
    headers, response: { session: {}, user: {} },
  } as never);
  const response = await request(app).get('/semester');
  expect(response.status).toBe(200);
  expect(response.headers['set-cookie']).toEqual(headers.getSetCookie());
});

it.each([['broken', '{broken'], ['oversized', JSON.stringify({ text: 'x'.repeat(110_000) })]])(
  'refuses signed-out %s JSON before parsing it', async (_name, body) => {
    const response = await request(app).patch('/semester').type('json').send(body);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sign in first' });
  }
);

it('still answers 400 for broken JSON from a signed-in student', async () => {
  const up = await signedUp();
  const response = await request(app).patch('/semester')
    .set('Cookie', up.headers['set-cookie']).type('json').send('{broken');
  expect(response.status).toBe(400);
});
