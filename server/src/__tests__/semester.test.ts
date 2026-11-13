import { resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn(); // every route outside /api/auth needs a session
});

beforeEach(() => resetDb());

describe('GET /semester', () => {
  it('returns the whole semester', async () => {
    const res = await api.get('/semester');
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Fall 2026');
    expect(res.body.courses).toHaveLength(5);
    expect(res.body.tasks).toHaveLength(36);
  });

  // US-02: the client shows the student's weekly capacity, so the server
  // has to send it.
  it('includes the weekly capacity in hours', async () => {
    const res = await api.get('/semester');
    expect(typeof res.body.weeklyCapacity).toBe('number');
    expect(res.body.weeklyCapacity).toBeGreaterThan(0);
  });

  it('includes the current week within the 15-week semester', async () => {
    const res = await api.get('/semester');
    expect(res.body.currentWeek).toBeGreaterThanOrEqual(1);
    expect(res.body.currentWeek).toBeLessThanOrEqual(15);
  });
});