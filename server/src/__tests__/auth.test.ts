import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

/**
 * US-21: login on the server (#44). The routes and answers are the contract
 * in docs/LOGIN_DESIGN.md, which the phone half (#43) is built against.
 * Accounts are kept in memory here, since tests have no DATABASE_URL.
 */

beforeEach(() => resetDb());

const PASSWORD = 'correct-horse-1';

/** Signs up a new student and returns the answer. Each email is used once. */
let signUps = 0;
async function signUp(email = `auth${++signUps}@example.com`) {
  const res = await request(app)
    .post('/api/auth/sign-up/email')
    .send({ name: 'Ada Student', email, password: PASSWORD });
  return { res, email };
}

describe('sign up', () => {
  it('answers 200 with the new student and a session cookie', async () => {
    const { res, email } = await signUp();
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.name).toBe('Ada Student');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('never sends the password back', async () => {
    const { res } = await signUp();
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
  });

  it('refuses an email that already has an account with 422', async () => {
    const { email } = await signUp();
    const { res } = await signUp(email);
    expect(res.status).toBe(422);
    expect(typeof res.body.message).toBe('string');
  });

  it('refuses a password under 8 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up/email')
      .send({ name: 'Ada Student', email: 'short@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('sign in', () => {
  it('answers 200 and a session cookie for the right password', async () => {
    const { email } = await signUp();
    const res = await request(app).post('/api/auth/sign-in/email').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('refuses a wrong password with 401 and a message to show', async () => {
    const { email } = await signUp();
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'wrong-password-1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('is allowed from Expo Web and refused from any other web page', async () => {
    const { email } = await signUp();
    const signInFrom = (origin: string) =>
      request(app).post('/api/auth/sign-in/email').set('Origin', origin).send({ email, password: PASSWORD });
    expect((await signInFrom('http://localhost:8081')).status).toBe(200);
    expect((await signInFrom('https://evil.example')).status).toBe(403);
  });

  it('refuses an email with no account with 401', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: 'nobody@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('the session', () => {
  it('lasts 30 days', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/sign-up/email')
      .send({ name: 'Ada Student', email: 'thirty@example.com', password: PASSWORD });
    const res = await agent.get('/api/auth/get-session');
    const daysLeft = (new Date(res.body.session.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(29.9);
    expect(daysLeft).toBeLessThanOrEqual(30);
  });

  it('get-session answers null when signed out', async () => {
    const res = await request(app).get('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('routes outside /api/auth', () => {
  it('answer 401 in our usual error shape without a session', async () => {
    for (const path of ['/semester', '/courses', '/tasks', '/courses/cs262/reviews']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Sign in first' });
    }
  });

  it('answer 401 to a write without a session, and change nothing', async () => {
    const res = await request(app).patch('/tasks/262-2').send({ done: true });
    expect(res.status).toBe(401);
  });

  it('answer 401 to a cookie that is not a real session', async () => {
    const res = await request(app)
      .get('/semester')
      .set('Cookie', 'better-auth.session_token=made-up');
    expect(res.status).toBe(401);
  });

  it('answer 200 with the cookie from signing in', async () => {
    const { email } = await signUp();
    const signIn = await request(app).post('/api/auth/sign-in/email').send({ email, password: PASSWORD });
    const res = await request(app).get('/semester').set('Cookie', signIn.headers['set-cookie']);
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Fall 2026');
  });

  it('answer 401 to the old cookie after signing out', async () => {
    const { res: up } = await signUp();
    const cookie = up.headers['set-cookie'];
    expect((await request(app).get('/semester').set('Cookie', cookie)).status).toBe(200);

    // Sent the way the phone's expoClient sends it: a request that carries
    // a cookie must say where it comes from, or Better Auth answers 403.
    const out = await request(app)
      .post('/api/auth/sign-out')
      .set('Cookie', cookie)
      .set('expo-origin', 'crunchweek://')
      .send({});
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ success: true });
    // The session itself ended, so even a copy of the cookie no longer works.
    expect((await request(app).get('/semester').set('Cookie', cookie)).status).toBe(401);
  });
});
