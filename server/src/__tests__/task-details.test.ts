import { resetDb } from '../data/db';
import { SupabaseStore } from '../data/supabase-store';
import { signedIn, withSample, type Api } from '../testing/session';

/**
 * US-44 (#159): an assignment's due week can be corrected on its details,
 * through PATCH /tasks/:id, as well as its hours. The title is left out for
 * now, so the route ignores one. m-1 in the sample
 * is "Problem set 1", MATH 251, due week 3, 3 hours.
 */

let api: Api;
beforeAll(async () => {
  api = await signedIn();
});

beforeEach(async () => {
  resetDb();
  await withSample(api);
});

const patch = (body: unknown) => api.patch('/tasks/m-1').send(body as object);

describe('PATCH /tasks/:id: the due week', () => {
  it('moves the task to another week, and keeps it there', async () => {
    const res = await patch({ dueWeek: 5 });
    expect(res.status).toBe(200);
    expect(res.body.dueWeek).toBe(5);
    expect((await api.get('/tasks/m-1')).body.dueWeek).toBe(5);
  });

  it.each([1, 15])('accepts week %i, the edge of the semester', async (dueWeek) => {
    const res = await patch({ dueWeek });
    expect(res.body.dueWeek).toBe(dueWeek);
  });

  it.each([
    ['0', 0],
    ['16', 16],
    ['2.5', 2.5],
    ['text', '5'],
    ['null', null],
  ])('refuses week %s, and changes nothing', async (_case, dueWeek) => {
    const res = await patch({ dueWeek });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dueWeek must be a whole number from 1 to 15' });
    expect((await api.get('/tasks/m-1')).body.dueWeek).toBe(3);
  });
});

describe('PATCH /tasks/:id: several fields at once', () => {
  it('changes the week and hours together', async () => {
    const res = await patch({ dueWeek: 4, estimatedHours: 5 });
    expect(res.body).toMatchObject({ id: 'm-1', dueWeek: 4, estimatedHours: 5 });
  });

  it('changes nothing when one field is bad', async () => {
    const res = await patch({ estimatedHours: 5, dueWeek: 99 });
    expect(res.status).toBe(400);
    expect((await api.get('/tasks/m-1')).body).toMatchObject({ dueWeek: 3, estimatedHours: 3 });
  });

  it('ignores a title: renaming is left out for now', async () => {
    const res = await patch({ title: 'Renamed', dueWeek: 4 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Problem set 1', dueWeek: 4 });
  });

  it('leaves the course alone, which the details do not change', async () => {
    const res = await patch({ dueWeek: 4, courseId: 'cs262' });
    expect(res.body.courseId).toBe('math251');
  });

  it("cannot change another student's task", async () => {
    const other = await signedIn();
    const res = await other.patch('/tasks/m-1').send({ dueWeek: 9 });
    expect(res.status).toBe(404);
    expect((await api.get('/tasks/m-1')).body.dueWeek).toBe(3);
  });
});

describe('PATCH /tasks/:id: nothing to update (TP-28)', () => {
  it.each([
    ['an empty body', {}],
    ['only fields it does not know', { courseId: 'cs262', colour: 'red' }],
    ['only a title, which is left out for now', { title: 'Renamed' }],
  ])('refuses %s, and changes nothing', async (_case, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Nothing to update: send done, estimatedHours or dueWeek' });
    expect((await api.get('/tasks/m-1')).body).toMatchObject({ title: 'Problem set 1', dueWeek: 3, estimatedHours: 3 });
  });

  it.each([
    ['a due week alone', { dueWeek: 4 }],
    ['hours alone', { estimatedHours: 5 }],
    ['done alone', { done: true }],
    ['null hours alone, which clears them', { estimatedHours: null }],
  ])('accepts %s', async (_case, body) => {
    const res = await patch(body);
    expect(res.status).toBe(200);
  });
});

describe('the Supabase store sends every changed field', () => {
  let calls: { method: string; body: unknown }[];
  beforeEach(() => {
    calls = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, options) => {
      calls.push({ method: options?.method ?? 'GET', body: options?.body ? JSON.parse(String(options.body)) : null });
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });
  afterEach(() => jest.restoreAllMocks());
  const store = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

  it('saves a change of week on its own (the check-in card, #155, sends only that)', async () => {
    await store().updateTask('alice', 'm-1', { dueWeek: 5 });
    const update = calls.find((c) => c.method === 'PATCH');
    expect(update?.body).toEqual({ due_week: 5 });
  });

  it('sends every field it is given in one update', async () => {
    await store().updateTask('alice', 'm-1', { dueWeek: 4, estimatedHours: 5, done: true });
    const updates = calls.filter((c) => c.method === 'PATCH');
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toEqual({ due_week: 4, estimated_hours: 5, done: true });
  });

  it('sends no update at all when nothing changes', async () => {
    await store().updateTask('alice', 'm-1', {});
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});
