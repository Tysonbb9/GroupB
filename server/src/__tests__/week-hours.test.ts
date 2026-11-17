import request from 'supertest';
import { app } from '../app';
import { CLIENT_ORIGIN } from '../auth';
import { resetDb } from '../data/db';
import { signedIn, withSample, type Api } from '../testing/session';

/**
 * #148, the follow-up to US-32: a student gives one week its own hours,
 * replacing their weekly number that week, and can clear it again. The
 * hours are kept in week_hours (#144) and come back with the semester.
 */

let api: Api;
let other: Api;
beforeAll(async () => {
  api = await signedIn();
  other = await signedIn();
});

beforeEach(async () => {
  resetDb();
  await withSample(api);
});

const setWeek = (week: number | string, body: unknown, client: Api = api) =>
  client.patch(`/semester/weeks/${week}`).send(body as object);

describe('PATCH /semester/weeks/:week', () => {
  it('gives one week its own hours, and returns every such week', async () => {
    const res = await setWeek(6, { hours: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ week: 6, hours: 25 }]);
  });

  it('lists the weeks in order, whatever order they were set in', async () => {
    await setWeek(9, { hours: 5 });
    const res = await setWeek(2, { hours: 30 });
    expect(res.body).toEqual([
      { week: 2, hours: 30 },
      { week: 9, hours: 5 },
    ]);
  });

  it('changes a week that already had its own hours', async () => {
    await setWeek(6, { hours: 25 });
    const res = await setWeek(6, { hours: 10 });
    expect(res.body).toEqual([{ week: 6, hours: 10 }]);
  });

  it('clears a week with null, so the weekly number applies again', async () => {
    await setWeek(6, { hours: 25 });
    await setWeek(7, { hours: 20 });
    const res = await setWeek(6, { hours: null });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ week: 7, hours: 20 }]);
  });

  it('clearing a week that had no hours of its own is fine', async () => {
    const res = await setWeek(6, { hours: null });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each([1, 15])('accepts week %i, the edge of the semester', async (week) => {
    const res = await setWeek(week, { hours: 10 });
    expect(res.status).toBe(200);
  });

  it.each([1, 80])('accepts %i hours, the edge of the weekly limits', async (hours) => {
    const res = await setWeek(6, { hours });
    expect(res.body).toEqual([{ week: 6, hours }]);
  });

  it.each([
    ['0', 0],
    ['16', 16],
    ['-1', -1],
    ['2.5', 2.5],
    ['abc', 'abc'],
    ['1e1', '1e1'],
  ])('refuses week %s, and changes nothing', async (_name, week) => {
    const res = await setWeek(week, { hours: 10 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'week must be a whole number from 1 to 15' });
    expect((await api.get('/semester')).body.weekHours).toEqual([]);
  });

  it.each([
    ['missing', {}],
    ['zero', { hours: 0 }],
    ['over 80', { hours: 81 }],
    ['not a whole number', { hours: 12.5 }],
    ['text', { hours: '20' }],
    ['true', { hours: true }],
  ])('refuses hours that are %s, and changes nothing', async (_case, body) => {
    await setWeek(6, { hours: 25 });
    const res = await setWeek(6, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'hours must be a whole number of hours from 1 to 80, or null' });
    expect((await api.get('/semester')).body.weekHours).toEqual([{ week: 6, hours: 25 }]);
  });

  it('does not change the weekly number', async () => {
    const before = (await api.get('/semester')).body.weeklyCapacity;
    await setWeek(6, { hours: 40 });
    expect((await api.get('/semester')).body.weeklyCapacity).toBe(before);
  });

  it("is a method the web app's CORS check allows, so Expo Web can call it", async () => {
    const res = await request(app)
      .options('/semester/weeks/6')
      .set('Origin', CLIENT_ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH');
    expect(res.headers['access-control-allow-methods']).toMatch(/\bPATCH\b/);
  });

  it('needs a signed-in student', async () => {
    const res = await request(app).patch('/semester/weeks/6').send({ hours: 10 });
    expect(res.status).toBe(401);
  });
});

describe('the semester carries the weeks with their own hours', () => {
  it('GET /semester has none until one is set', async () => {
    const res = await api.get('/semester');
    expect(res.body.weekHours).toEqual([]);
  });

  it('GET /semester returns them once set', async () => {
    await setWeek(6, { hours: 25 });
    const res = await api.get('/semester');
    expect(res.body.weekHours).toEqual([{ week: 6, hours: 25 }]);
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  it('PATCH /semester returns them with the new weekly number', async () => {
    await setWeek(6, { hours: 25 });
    const res = await api.patch('/semester').send({ weeklyCapacity: 20 });
    expect(res.body.weeklyCapacity).toBe(20);
    expect(res.body.weekHours).toEqual([{ week: 6, hours: 25 }]);
  });

  it('POST /semester/sample returns an empty list for a new account', async () => {
    const fresh = await signedIn();
    const res = await fresh.post('/semester/sample');
    expect(res.status).toBe(201);
    expect(res.body.weekHours).toEqual([]);
  });
});

describe("each student's weeks are their own", () => {
  it("one student's weeks never show in another's semester", async () => {
    await setWeek(6, { hours: 25 });
    await withSample(other);
    expect((await other.get('/semester')).body.weekHours).toEqual([]);
  });

  it("clearing a week leaves another student's week alone", async () => {
    await withSample(other);
    await setWeek(6, { hours: 25 }, other);
    await setWeek(6, { hours: null });
    expect((await other.get('/semester')).body.weekHours).toEqual([{ week: 6, hours: 25 }]);
  });
});
