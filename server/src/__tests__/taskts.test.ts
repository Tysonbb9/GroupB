import { resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

let api: Api;
beforeAll(async () => {
  api = await signedIn(); // every route outside /api/auth needs a session
});

beforeEach(() => resetDb());

describe('GET /tasks', () => {
  it('returns every task when no filters are given', async () => {
    const res = await api.get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(36);
  });

  it('filters by courseId', async () => {
    const res = await api.get('/tasks?courseId=cs262');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);

    // Every returned task belongs to CS 262
    for (const task of res.body) {
      expect(task.courseId).toBe('cs262');
    }
  });

  it('filters by week (TP-08)', async () => {
    const res = await api.get('/tasks?week=7');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);

    for (const task of res.body) {
      expect(task.dueWeek).toBe(7);
    }
  });

  it('filters by done (TP-09)', async () => {
    const res = await api.get('/tasks?done=true');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    for (const task of res.body) {
      expect(task.done).toBe(true);
    }
  });

  it('combines filters (TP-10)', async () => {
    const res = await api.get(
      '/tasks?courseId=cs262&week=4&done=false'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const task = res.body[0];

    expect(task.id).toBe('262-3');
    expect(task.courseId).toBe('cs262');
    expect(task.dueWeek).toBe(4);
    expect(task.done).toBe(false);
  });

  it('returns 400 when week is not a number (TP-11)', async () => {
    const res = await api.get('/tasks?week=abc');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('returns 400 when done is not true or false (TP-12)', async () => {
    const res = await api.get('/tasks?done=maybe');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('returns an empty list for an unknown course (TP-13)', async () => {
    const res = await api.get('/tasks?courseId=nope');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 when week is outside 1 to 15 (TP-14)', async () => {
    const res = await api.get('/tasks?week=99');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('returns 400 when week is empty (TP-15)', async () => {
    const res = await api.get('/tasks?week=');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it.each([
    ['zero', '0'],
    ['above maximum', '16'],
    ['spaces', '   '],
    ['decimal notation', '7.0'],
  ])('returns 400 when week is %s', async (_description, week) => {
    const res = await api.get('/tasks').query({ week });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
  });

});

describe('GET /tasks/:id', () => {
  it('returns the task when the id exists (TP-16)', async () => {
    const res = await api.get('/tasks/262-2');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('262-2');
    expect(res.body.title).toBe('Vision statement');
  });

  it('returns 404 for an unknown id (TP-17)', async () => {
    const res = await api.get('/tasks/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toEqual(expect.any(String));
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

describe('PATCH /tasks/:id', () => {
  it('marks a task done, and the change sticks', async () => {
    const patch = await api.patch('/tasks/262-2').send({ done: true });
    expect(patch.status).toBe(200);
    expect(patch.body.done).toBe(true);

    // ask again to prove the "database" really changed
    const get = await api.get('/tasks/262-2');
    expect(get.body.done).toBe(true);
  });

  it.todo('sets estimatedHours');                    // send { estimatedHours: 4 }
  it.todo('clears estimatedHours with null');         // send { estimatedHours: null }
  it.todo('returns 400 when done is not a boolean');  // send { done: 'yes' }
  it.todo('returns 400 when estimatedHours is negative'); // send { estimatedHours: -1 }
  it('does not change anything when one field is good and one is bad', async () => {
    // done is valid but estimatedHours is not. If the route saved fields
    // one by one, done would flip to true before the error.
    const res = await api.patch('/tasks/262-2').send({ done: true, estimatedHours: -1 });
    expect(res.status).toBe(400);

    const get = await api.get('/tasks/262-2');
    expect(get.body.done).toBe(false);        // the good field was NOT saved
    expect(get.body.estimatedHours).toBe(2);  // the bad field was NOT saved
  });
  it.todo('returns 404 for an unknown id');

  // TP-25 and TP-26 (risk R1): the same limits as the client (MAX_ESTIMATE_HOURS)
  // and the database CHECK in server/db/schema.sql, so the database never
  // rejects what the API accepted.
  it('accepts estimatedHours of exactly 100', async () => {
    const res = await api.patch('/tasks/262-2').send({ estimatedHours: 100 });
    expect(res.status).toBe(200);
    expect(res.body.estimatedHours).toBe(100);
  });

  it.each([[0], [100.5], [101]])('returns 400 when estimatedHours is %p', async (hours) => {
    const res = await api.patch('/tasks/262-2').send({ estimatedHours: hours });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estimatedHours/);

    // the task keeps its old estimate
    const get = await api.get('/tasks/262-2');
    expect(get.body.estimatedHours).toBe(2);
  });
});
