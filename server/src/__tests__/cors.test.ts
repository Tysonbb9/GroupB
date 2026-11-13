import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn(); // every route outside /api/auth needs a session
});

beforeEach(() => resetDb());

// A browser (Expo Web) only lets the client read the server's answer when the
// server says so with these headers. A phone does not check them.
describe('CORS', () => {
  it('lets a web page on another address read a response', async () => {
    const res = await api.get('/semester').set('Origin', 'http://localhost:8081');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('answers the preflight check that comes before a PATCH', async () => {
    const res = await request(app)
      .options('/tasks/262-2')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });
});
