import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

const EXPO_WEB = 'http://localhost:8081'; // CLIENT_ORIGIN's default

let api: Api;
beforeAll(async () => {
  api = await signedIn();
});

beforeEach(() => resetDb());

// A browser (Expo Web) only lets the client read the server's answer when the
// server says so with these headers. A phone does not check them. With login
// the browser sends a cookie, so the server names Expo Web's address in place
// of "*" and says cookies are allowed.
describe('CORS', () => {
  it('lets Expo Web read a response sent with the session cookie', async () => {
    const res = await api.get('/semester').set('Origin', EXPO_WEB);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(EXPO_WEB);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends the same headers on the login routes', async () => {
    const res = await request(app).get('/api/auth/get-session').set('Origin', EXPO_WEB);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(EXPO_WEB);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('answers the preflight check that comes before a PATCH, with no session', async () => {
    const res = await request(app)
      .options('/tasks/262-2')
      .set('Origin', EXPO_WEB)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });
});
