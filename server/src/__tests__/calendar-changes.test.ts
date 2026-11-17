import express from 'express';
import request from 'supertest';
import { app } from '../app';
import { findChanges } from '../calendar/changes';
import type { CalendarEvent } from '../calendar/ics';
import { calendarRouter } from '../calendar/routes';
import { resetDb } from '../data/db';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';

/**
 * US-50 (#166): picking up new, moved and removed deadlines from a Moodle
 * calendar, and settling each one only when the student says so. Today is
 * fixed at Wednesday 18 November 2026, week 3, so week 1 began 2 November.
 */

const START = new Date('2026-11-02T00:00:00Z');
const TODAY = new Date('2026-11-18T15:00:00Z');
const LINK = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=1&authtoken=secret-token';

describe('findChanges', () => {
  const ev = (uid: string, iso: string): CalendarEvent => ({ uid, title: uid, start: new Date(iso), categories: [] });
  const tasks = [
    { id: 't1', title: 'Lab 9', dueWeek: 4 },
    { id: 't2', title: 'Quiz 3', dueWeek: 5 },
    { id: 't3', title: 'Essay', dueWeek: 6 },
  ];
  const imports = [
    { eventId: 'e1', taskId: 't1', dueWeek: 4 },
    { eventId: 'e2', taskId: 't2', dueWeek: 5 },
    { eventId: 'e3', taskId: 't3', dueWeek: 6 },
  ];

  it('finds nothing when every event is where it was', () => {
    const events = [ev('e1', '2026-11-25T12:00:00Z'), ev('e2', '2026-12-02T12:00:00Z'), ev('e3', '2026-12-09T12:00:00Z')];
    expect(findChanges(events, imports, tasks, START)).toEqual([]);
  });

  it('finds an event moved to another week, with the weeks it moved between', () => {
    const events = [ev('e1', '2026-12-16T12:00:00Z'), ev('e2', '2026-12-02T12:00:00Z'), ev('e3', '2026-12-09T12:00:00Z')];
    expect(findChanges(events, imports, tasks, START)).toEqual([
      { kind: 'moved', eventId: 'e1', taskId: 't1', title: 'Lab 9', fromWeek: 4, toWeek: 7 },
    ]);
  });

  it('finds an event that is gone from the calendar', () => {
    const events = [ev('e1', '2026-11-25T12:00:00Z'), ev('e3', '2026-12-09T12:00:00Z')];
    expect(findChanges(events, imports, tasks, START)).toEqual([
      { kind: 'removed', eventId: 'e2', taskId: 't2', title: 'Quiz 3', week: 5 },
    ]);
  });

  it('treats an event moved outside weeks 1 to 15 as removed', () => {
    const events = [ev('e1', '2027-06-01T12:00:00Z'), ev('e2', '2026-12-02T12:00:00Z'), ev('e3', '2026-12-09T12:00:00Z')];
    expect(findChanges(events, imports, tasks, START)).toEqual([
      { kind: 'removed', eventId: 'e1', taskId: 't1', title: 'Lab 9', week: 4 },
    ]);
  });

  it('leaves out an event whose task the student already deleted', () => {
    expect(findChanges([], imports, tasks.slice(1), START).map((c) => c.eventId)).toEqual(['e2', 'e3']);
  });

  it('lists the changes soonest first', () => {
    const changes = findChanges([ev('e1', '2027-01-20T12:00:00Z')], imports, tasks, START);
    expect(changes.map((c) => c.eventId)).toEqual(['e2', 'e3', 'e1']); // weeks 5, 6, then 12
  });
});

/** A calendar with these events, as Moodle would send it. */
function calendar(events: [uid: string, summary: string, dtstart: string, category: string][]) {
  return [
    'BEGIN:VCALENDAR',
    ...events.flatMap(([uid, summary, dtstart, category]) => [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `SUMMARY:${summary}`,
      `DTSTART:${dtstart}`,
      `CATEGORIES:${category}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n');
}

const LAB_WEEK_4 = ['e1', 'Lab 9 is due', '20261126T045900Z', 'CS262'] as [string, string, string, string];
const QUIZ_WEEK_5 = ['e2', 'Quiz 3 is due', '20261203T045900Z', 'MATH251'] as [string, string, string, string];
const LAB_WEEK_7 = ['e1', 'Lab 9 is due', '20261217T045900Z', 'CS262'] as [string, string, string, string];

const store = new MemoryStore();
let students = 0;
let userId = '';
let body = '';

/** A student who added Lab 9 (week 4) and Quiz 3 (week 5) from their calendar. */
async function studentWithImports() {
  students += 1;
  userId = `student-${students}`;
  await store.loadSample(userId);
  await store.saveCalendarLink(userId, LINK);
  body = calendar([LAB_WEEK_4, QUIZ_WEEK_5]);
  const small = express();
  small.use(express.json());
  small.use((_req, res, next) => {
    res.locals.session = { user: { id: userId } };
    next();
  });
  const fetchFn = jest.fn(async (_url: string | URL | Request) => new Response(body, { status: 200 }));
  small.use('/calendar', calendarRouter(store, fetchFn as unknown as typeof fetch, () => ['moodle.calvin.edu'], () => TODAY));
  const api = request.agent(small);
  const added = await api.post('/calendar/events').send({
    tasks: [
      { eventId: 'e1', courseId: 'cs262', title: 'Lab 9', dueWeek: 4 },
      { eventId: 'e2', courseId: 'math251', title: 'Quiz 3', dueWeek: 5 },
    ],
  });
  const [lab, quiz] = added.body.tasks;
  return { api, lab, quiz };
}

const taskNow = async (id: string) => store.getTask(userId, id);

beforeEach(() => resetDb());

describe('GET /calendar/changes', () => {
  it('finds no changes when the calendar is as it was', async () => {
    const { api } = await studentWithImports();
    const res = await api.get('/calendar/changes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ changes: [], newEvents: 0 });
  });

  it('finds a moved deadline and a removed one', async () => {
    const { api, lab, quiz } = await studentWithImports();
    body = calendar([LAB_WEEK_7]);
    const res = await api.get('/calendar/changes');
    expect(res.body.changes).toEqual([
      { kind: 'removed', eventId: 'e2', taskId: quiz.id, title: 'Quiz 3', week: 5 },
      { kind: 'moved', eventId: 'e1', taskId: lab.id, title: 'Lab 9', fromWeek: 4, toWeek: 7 },
    ]);
  });

  it('counts new events waiting for review', async () => {
    const { api } = await studentWithImports();
    body = calendar([LAB_WEEK_4, QUIZ_WEEK_5, ['e9', 'Essay 2 is due', '20261210T045900Z', 'PHIL153']]);
    expect((await api.get('/calendar/changes')).body.newEvents).toBe(1);
  });

  it('changes nothing just by looking', async () => {
    const { api, lab } = await studentWithImports();
    body = calendar([LAB_WEEK_7]);
    await api.get('/calendar/changes');
    expect((await taskNow(lab.id))?.dueWeek).toBe(4);
  });

  it('says in plain words when the link stopped working', async () => {
    const { api } = await studentWithImports();
    body = '<html>Log in to Moodle</html>';
    const res = await api.get('/calendar/changes');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'That link did not give a calendar. In Moodle, use Export calendar, then Get calendar URL.',
    });
  });
});

describe('POST /calendar/changes', () => {
  it('accepting a move changes the task to the new week, and the change stops showing', async () => {
    const { api, lab } = await studentWithImports();
    body = calendar([LAB_WEEK_7, QUIZ_WEEK_5]);
    const res = await api.post('/calendar/changes').send({ accept: ['e1'] });

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([expect.objectContaining({ id: lab.id, dueWeek: 7 })]);
    expect((await taskNow(lab.id))?.dueWeek).toBe(7);
    expect((await api.get('/calendar/changes')).body.changes).toEqual([]);
  });

  it('accepting a removal deletes the task, and the change stops showing', async () => {
    const { api, quiz } = await studentWithImports();
    body = calendar([LAB_WEEK_4]);
    const res = await api.post('/calendar/changes').send({ accept: ['e2'] });

    expect(res.body.removedTaskIds).toEqual([quiz.id]);
    expect(await taskNow(quiz.id)).toBeNull();
    expect((await api.get('/calendar/changes')).body.changes).toEqual([]);
  });

  it('keeping a move leaves the task in its week, and the change stops showing', async () => {
    const { api, lab } = await studentWithImports();
    body = calendar([LAB_WEEK_7, QUIZ_WEEK_5]);
    const res = await api.post('/calendar/changes').send({ keep: ['e1'] });

    expect(res.body).toEqual({ tasks: [], removedTaskIds: [] });
    expect((await taskNow(lab.id))?.dueWeek).toBe(4);
    expect((await api.get('/calendar/changes')).body.changes).toEqual([]);
  });

  it('keeping a removal leaves the task, and the change stops showing', async () => {
    const { api, quiz } = await studentWithImports();
    body = calendar([LAB_WEEK_4]);
    await api.post('/calendar/changes').send({ keep: ['e2'] });
    expect(await taskNow(quiz.id)).not.toBeNull();
    expect((await api.get('/calendar/changes')).body.changes).toEqual([]);
  });

  it('settles only the changes named, and leaves the rest showing', async () => {
    const { api, quiz } = await studentWithImports();
    body = calendar([LAB_WEEK_7]);
    await api.post('/calendar/changes').send({ accept: ['e1'] });
    expect(await taskNow(quiz.id)).not.toBeNull();
    expect((await api.get('/calendar/changes')).body.changes.map((c: { eventId: string }) => c.eventId)).toEqual(['e2']);
  });

  it('ignores an id that is not a current change, so a stale tap changes nothing', async () => {
    const { api, lab } = await studentWithImports();
    // The calendar moved Lab 9, but by the time the student taps, it moved back.
    body = calendar([LAB_WEEK_4, QUIZ_WEEK_5]);
    const res = await api.post('/calendar/changes').send({ accept: ['e1', 'nope'] });
    expect(res.body).toEqual({ tasks: [], removedTaskIds: [] });
    expect((await taskNow(lab.id))?.dueWeek).toBe(4);
  });

  it.each([
    ['nothing', {}],
    ['empty lists', { accept: [], keep: [] }],
    ['a list that is not of ids', { accept: [1] }],
    ['the same event in both', { accept: ['e1'], keep: ['e1'] }],
  ])('refuses %s with a 400', async (_case, payload) => {
    const { api } = await studentWithImports();
    expect((await api.post('/calendar/changes').send(payload)).status).toBe(400);
  });

  it('changes nothing when the calendar cannot be read', async () => {
    const { api, lab } = await studentWithImports();
    body = '';
    const res = await api.post('/calendar/changes').send({ accept: ['e1'] });
    expect(res.status).toBe(422);
    expect((await taskNow(lab.id))?.dueWeek).toBe(4);
  });
});

describe('the routes in the real app', () => {
  it('need a signed-in student', async () => {
    expect((await request(app).get('/calendar/changes')).status).toBe(401);
    expect((await request(app).post('/calendar/changes').send({ accept: ['e1'] })).status).toBe(401);
  });
});

describe('the stores delete tasks and forget imports', () => {
  it("the in-memory store deletes only that student's task, and says whether it did", async () => {
    const memory = new MemoryStore();
    await memory.loadSample('sam');
    await memory.loadSample('alex');
    await expect(memory.deleteTask('sam', 'm-1')).resolves.toBe(true);
    await expect(memory.getTask('sam', 'm-1')).resolves.toBeNull();
    await expect(memory.getTask('alex', 'm-1')).resolves.not.toBeNull();
    await expect(memory.deleteTask('sam', 'm-1')).resolves.toBe(false);
  });

  it('the in-memory store forgets only the named imports', async () => {
    const memory = new MemoryStore();
    await memory.recordCalendarImports('sam', [
      { eventId: 'e1', taskId: 't1', dueWeek: 4 },
      { eventId: 'e2', taskId: 't2', dueWeek: 5 },
    ]);
    await memory.deleteCalendarImports('sam', ['e1']);
    await expect(memory.listCalendarImports('sam')).resolves.toEqual([{ eventId: 'e2', taskId: 't2', dueWeek: 5 }]);
  });

  describe('the Supabase store', () => {
    let calls: { url: URL; method: string }[];
    beforeEach(() => {
      calls = [];
      jest.spyOn(global, 'fetch').mockImplementation(async (input, options) => {
        calls.push({ url: new URL(String(input)), method: options?.method ?? 'GET' });
        return new Response(JSON.stringify([{ id: 'm-1' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const supabase = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

    it("deletes only that student's task", async () => {
      await expect(supabase().deleteTask('alice', 'm-1')).resolves.toBe(true);
      expect(calls[0].method).toBe('DELETE');
      expect(calls[0].url.pathname).toMatch(/tasks$/);
      expect(calls[0].url.searchParams.get('user_id')).toBe('eq.alice');
      expect(calls[0].url.searchParams.get('id')).toBe('eq.m-1');
    });

    it("forgets only that student's named imports, and sends nothing for none", async () => {
      await supabase().deleteCalendarImports('alice', ['e1', 'e2']);
      expect(calls[0].method).toBe('DELETE');
      expect(calls[0].url.searchParams.get('user_id')).toBe('eq.alice');
      expect(calls[0].url.searchParams.get('event_uid')).toBe('in.(e1,e2)');
      calls = [];
      await supabase().deleteCalendarImports('alice', []);
      expect(calls).toHaveLength(0);
    });
  });
});
