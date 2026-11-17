import express from 'express';
import request from 'supertest';
import { app } from '../app';
import { calendarRouter } from '../calendar/routes';
import { resetDb } from '../data/db';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';
import { signedIn } from '../testing/session';

/**
 * US-48 (#164): GET and POST /calendar/link. Like the other route tests,
 * the router is mounted on a small app with a pretend signed-in student and
 * a fake fetch, so nothing real is ever fetched. The real app's login check
 * is tested at the bottom.
 */

const MOODLE = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=123&authtoken=secret-token&preset_what=all';
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

const store = new MemoryStore();
let students = 0;
let userId = '';

function appWith(fetchFn: jest.Mock) {
  students += 1;
  userId = `student-${students}`;
  const small = express();
  small.use(express.json());
  small.use((_req, res, next) => {
    res.locals.session = { user: { id: userId } }; // what app.ts's login check puts here
    next();
  });
  small.use('/calendar', calendarRouter(store, fetchFn as unknown as typeof fetch, () => ['moodle.calvin.edu']));
  return request.agent(small);
}

const answers = (status: number, body = '') =>
  jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, { status }));

beforeEach(() => resetDb());

describe('GET /calendar/link', () => {
  it('says no link is saved at first', async () => {
    const res = await appWith(answers(200, ICS)).get('/calendar/link');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: false, savedAt: null });
  });

  it('says a link is saved, and when, but never sends the link', async () => {
    const api = appWith(answers(200, ICS));
    await api.post('/calendar/link').send({ url: MOODLE });
    const res = await api.get('/calendar/link');
    expect(res.body).toEqual({ saved: true, savedAt: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });
});

describe('POST /calendar/link', () => {
  it('fetches the link once, and saves it when it gives a calendar', async () => {
    const fetchFn = answers(200, ICS);
    const api = appWith(fetchFn);
    const res = await api.post('/calendar/link').send({ url: MOODLE });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ saved: true, savedAt: expect.any(String) });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(MOODLE);
    await expect(store.getCalendarLink(userId)).resolves.toMatchObject({ url: MOODLE });
  });

  it('never sends the link back', async () => {
    const res = await appWith(answers(200, ICS)).post('/calendar/link').send({ url: MOODLE });
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });

  it('replaces an earlier link', async () => {
    const api = appWith(answers(200, ICS));
    await api.post('/calendar/link').send({ url: MOODLE });
    const newer = MOODLE.replace('secret-token', 'newer-token');
    await api.post('/calendar/link').send({ url: newer });
    await expect(store.getCalendarLink(userId)).resolves.toMatchObject({ url: newer });
  });

  it.each([
    ['no link', {}],
    ['another site', { url: 'https://example.com/cal.ics' }],
    ['an http link', { url: MOODLE.replace('https', 'http') }],
    ['an address on this machine', { url: 'https://127.0.0.1/cal' }],
  ])('refuses %s with a 400, without fetching or saving', async (_case, body) => {
    const fetchFn = answers(200, ICS);
    const api = appWith(fetchFn);
    const res = await api.post('/calendar/link').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(fetchFn).not.toHaveBeenCalled();
    await expect(store.getCalendarLink(userId)).resolves.toBeNull();
  });

  it.each([
    ['a page that is not a calendar', 200, '<html>Log in</html>'],
    ['an error from Moodle', 403, 'Forbidden'],
    ['a redirect (a wrong token)', 303, ''],
  ])('refuses %s with a 422, and saves nothing', async (_case, status, body) => {
    const api = appWith(answers(status, body));
    const res = await api.post('/calendar/link').send({ url: MOODLE });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual(expect.any(String));
    await expect(store.getCalendarLink(userId)).resolves.toBeNull();
  });

  it('says Moodle could not be reached with a 502, and saves nothing', async () => {
    const fetchFn = jest.fn(async (_url: string | URL | Request) => {
      throw new TypeError('network down');
    });
    const res = await appWith(fetchFn).post('/calendar/link').send({ url: MOODLE });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Moodle could not be reached. Try again in a moment.' });
    await expect(store.getCalendarLink(userId)).resolves.toBeNull();
  });

  it('keeps the earlier link when a new one does not work', async () => {
    const fetchFn = answers(200, ICS);
    const api = appWith(fetchFn);
    await api.post('/calendar/link').send({ url: MOODLE });
    fetchFn.mockResolvedValueOnce(new Response('<html></html>', { status: 200 }));
    await api.post('/calendar/link').send({ url: MOODLE.replace('secret-token', 'bad-token') });
    await expect(store.getCalendarLink(userId)).resolves.toMatchObject({ url: MOODLE });
  });

  it('never puts the link in an error message', async () => {
    const api = appWith(answers(403, ''));
    const res = await api.post('/calendar/link').send({ url: MOODLE });
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });

  it("keeps each student's link apart", async () => {
    const first = appWith(answers(200, ICS));
    await first.post('/calendar/link').send({ url: MOODLE });
    const firstId = userId;
    const second = appWith(answers(200, ICS));
    expect((await second.get('/calendar/link')).body).toEqual({ saved: false, savedAt: null });
    await expect(store.getCalendarLink(firstId)).resolves.not.toBeNull();
  });
});

describe('/calendar/link in the real app', () => {
  it('needs a signed-in student', async () => {
    expect((await request(app).get('/calendar/link')).status).toBe(401);
    expect((await request(app).post('/calendar/link').send({ url: MOODLE })).status).toBe(401);
  });

  it('refuses a link to another site before fetching anything', async () => {
    const api = await signedIn();
    const res = await api.post('/calendar/link').send({ url: 'https://example.com/cal.ics' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The link must be a calendar link from moodle.calvin.edu.' });
  });
});

describe('the stores keep the link', () => {
  it('the in-memory store saves it, replaces it, and hands back a copy', async () => {
    const memory = new MemoryStore();
    await expect(memory.getCalendarLink('sam')).resolves.toBeNull();
    const saved = await memory.saveCalendarLink('sam', MOODLE);
    expect(saved).toEqual({ url: MOODLE, savedAt: expect.any(String) });
    saved.url = 'changed';
    await expect(memory.getCalendarLink('sam')).resolves.toMatchObject({ url: MOODLE });
    resetDb();
    await expect(memory.getCalendarLink('sam')).resolves.toBeNull();
  });

  describe('the Supabase store', () => {
    let calls: { url: URL; method: string; body: unknown }[];
    beforeEach(() => {
      calls = [];
      jest.spyOn(global, 'fetch').mockImplementation(async (input, options) => {
        const url = new URL(String(input));
        const method = options?.method ?? 'GET';
        calls.push({ url, method, body: options?.body ? JSON.parse(String(options.body)) : null });
        const row = { url: MOODLE, saved_at: '2026-11-16T20:00:00+00:00' };
        return new Response(JSON.stringify(method === 'GET' ? [row] : row), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const supabase = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

    it("reads only that student's row from calendar_links", async () => {
      const link = await supabase().getCalendarLink('alice');
      expect(link).toEqual({ url: MOODLE, savedAt: '2026-11-16T20:00:00.000Z' });
      expect(calls[0].url.pathname).toMatch(/calendar_links$/);
      expect(calls[0].url.searchParams.get('user_id')).toBe('eq.alice');
    });

    it('upserts on the student, so a new link replaces the old', async () => {
      await supabase().saveCalendarLink('alice', MOODLE);
      const write = calls.find((c) => c.method === 'POST')!;
      expect(write.url.pathname).toMatch(/calendar_links$/);
      expect(write.url.searchParams.get('on_conflict')).toBe('user_id');
      expect(write.body).toMatchObject({ user_id: 'alice', url: MOODLE });
    });
  });
});
