import request from 'supertest';
import { app } from '../app';

/** A signed-in client of the app, as signedIn() returns it. */
export type Api = ReturnType<typeof request.agent>;

let students = 0;

/**
 * Every route outside /api/auth needs a session (US-21), so tests sign in
 * first. Signs up a new test student (kept in memory, since tests have no
 * DATABASE_URL) and returns a supertest agent: it keeps the session cookie
 * and sends it with every request, like the phone does.
 */
export async function signedIn(): Promise<Api> {
  students += 1;
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/sign-up/email').send({
    name: `Test Student ${students}`,
    email: `student${students}@example.com`,
    password: 'test-password-1',
  });
  if (res.status !== 200) {
    throw new Error(`Test sign-up failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return agent;
}
