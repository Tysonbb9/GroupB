import express from 'express';
import request from 'supertest';
import { app } from '../app';
import { calendarRouter } from '../calendar/routes';
import { resetDb } from '../data/db';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';

/**
 * US-49 (#165): GET /calendar/events proposes the saved calendar's events
 * as tasks, and POST /calendar/events adds the ones the student kept. The
 * fetch is a fake and today is fixed: Wednesday 18 November 2026, in week 3
 * of the sample semester, so week 1 began on Monday 2 November.
 */

const LINK = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=1&authtoken=secret-token';
const TODAY = new Date('2026-11-18T15:00:00Z');

const event = (uid: string, summary: string, dtstart: string, category?: string) =>
  ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${summary}`, `DTSTART:${dtstart}`, ...(category ? [`CATEGORIES:${category}`] : []), 'END:VEVENT'];

const CALENDAR = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ...event('e1', 'Lab 9 is due', '20261126T045900Z', 'CS262-A FA26'), // week 4
  ...event('e2', 'Quiz 3 is due', '20261203T045900Z', 'MATH251-B FA26'), // week 5
  ...event('e3', 'Club social', '20261119T230000Z'), // week 3, no course
  ...event('e4', 'Lab 2 is due', '20261119T045900Z', 'CS336'), // week 3; the sample's "Lab 2: Layout" has another title
  ...event('e5', 'Summer reading', '20260801T120000Z', 'CS262'), // before week 1
  'END:VCALENDAR',
  '',
].join('\r\n');

const store = new MemoryStore();
let students = 0;
let userId = '';

async function appWith(fetchBody = CALENDAR, status = 200, saveLink = true) {
  students += 1;
  userId = `student-${students}`;
  await store.loadSample(userId);
  if (saveLink) await store.saveCalendarLink(userId, LINK);
  const fetchFn = jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(fetchBody, { status }));
  const small = express();
  small.use(express.json());
  small.use((_req, res, next) => {
    res.locals.session = { user: { id: userId } }; // what app.ts's login check puts here
    next();
  });
  small.use('/calendar', calendarRouter(store, fetchFn as unknown as typeof fetch, () => ['moodle.calvin.edu'], () => TODAY));
  return { api: request.agent(small), fetchFn };
}

beforeEach(() => resetDb());

describe('GET /calendar/events', () => {
  it('proposes each event in the semester as a task, soonest first, with its week and course', async () => {
    const { api, fetchFn } = await appWith();
    const res = await api.get('/calendar/events');

    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledWith(LINK, expect.objectContaining({ redirect: 'manual' }));
    expect(res.body.proposals).toEqual([
      { eventId: 'e3', title: 'Club social', dueWeek: 3, courseId: null, alreadyInSemester: false },
      { eventId: 'e4', title: 'Lab 2', dueWeek: 3, courseId: 'cs336', alreadyInSemester: false },
      { eventId: 'e1', title: 'Lab 9', dueWeek: 4, courseId: 'cs262', alreadyInSemester: false },
      { eventId: 'e2', title: 'Quiz 3', dueWeek: 5, courseId: 'math251', alreadyInSemester: false },
    ]);
    expect(res.body.outsideSemester).toBe(1);
    expect(res.body.alreadyAdded).toBe(0);
  });

  it('marks an event the syllabus already added', async () => {
    // The sample has "Lab 2: Layout" in CS 336, week 4; an event with that exact title in week 4 matches.
    const cal = ['BEGIN:VCALENDAR', ...event('s1', 'Lab 2: Layout is due', '20261126T045900Z', 'CS336'), 'END:VCALENDAR'].join('\r\n');
    const { api } = await appWith(cal);
    const res = await api.get('/calendar/events');
    expect(res.body.proposals[0]).toMatchObject({ eventId: 's1', courseId: 'cs336', dueWeek: 4, alreadyInSemester: true });
  });

  it('says to save a link first when there is none (409), without fetching', async () => {
    const { api, fetchFn } = await appWith(CALENDAR, 200, false);
    const res = await api.get('/calendar/events');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Save your Moodle calendar link first.' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('says in plain words when the saved link stops working', async () => {
    const { api } = await appWith('', 303);
    const res = await api.get('/calendar/events');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'Moodle did not accept that link. Copy a new calendar link from Moodle.' });
  });

  it('says so when Moodle sends something that is not a calendar', async () => {
    const { api } = await appWith('<html>Log in</html>');
    expect((await api.get('/calendar/events')).status).toBe(422);
  });

  it('never sends the link back, even in an error', async () => {
    const { api } = await appWith('', 500);
    const res = await api.get('/calendar/events');
    expect(JSON.stringify(res.body)).not.toContain('secret-token');
  });

  it('proposes nothing for a calendar with no events', async () => {
    const { api } = await appWith('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    const res = await api.get('/calendar/events');
    expect(res.body).toEqual({ proposals: [], alreadyAdded: 0, outsideSemester: 0 });
  });
});

describe('POST /calendar/events', () => {
  const lab9 = { eventId: 'e1', courseId: 'cs262', title: 'Lab 9', dueWeek: 4 };
  const quiz3 = { eventId: 'e2', courseId: 'math251', title: 'Quiz 3', dueWeek: 5 };

  it('adds the kept events as tasks with no hours, and returns them with their ids', async () => {
    const { api } = await appWith();
    const res = await api.post('/calendar/events').send({ tasks: [lab9, quiz3] });

    expect(res.status).toBe(201);
    expect(res.body.tasks).toEqual([
      expect.objectContaining({ courseId: 'cs262', title: 'Lab 9', dueWeek: 4, estimatedHours: null, done: false }),
      expect.objectContaining({ courseId: 'math251', title: 'Quiz 3', dueWeek: 5, estimatedHours: null }),
    ]);
    const tasks = await store.listTasks(userId, {});
    expect(tasks.some((t) => t.title === 'Lab 9' && t.dueWeek === 4)).toBe(true);
  });

  it('keeps hours the student typed', async () => {
    const { api } = await appWith();
    const res = await api.post('/calendar/events').send({ tasks: [{ ...lab9, estimatedHours: 3 }] });
    expect(res.body.tasks[0].estimatedHours).toBe(3);
  });

  it('records which event each task came from, with its week', async () => {
    const { api } = await appWith();
    const res = await api.post('/calendar/events').send({ tasks: [lab9] });
    await expect(store.listCalendarImports(userId)).resolves.toEqual([
      { eventId: 'e1', taskId: res.body.tasks[0].id, dueWeek: 4 },
    ]);
  });

  it('does not offer an added event again', async () => {
    const { api } = await appWith();
    await api.post('/calendar/events').send({ tasks: [lab9] });
    const res = await api.get('/calendar/events');
    expect(res.body.proposals.map((p: { eventId: string }) => p.eventId)).not.toContain('e1');
    expect(res.body.alreadyAdded).toBe(1);
  });

  it('refuses an event added before (409), and adds nothing', async () => {
    const { api } = await appWith();
    await api.post('/calendar/events').send({ tasks: [lab9] });
    const before = (await store.listTasks(userId, {})).length;
    const res = await api.post('/calendar/events').send({ tasks: [quiz3, lab9] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Task 2: that calendar event was already added' });
    expect((await store.listTasks(userId, {})).length).toBe(before);
  });

  it('refuses the same event twice in one request', async () => {
    const { api } = await appWith();
    const res = await api.post('/calendar/events').send({ tasks: [lab9, lab9] });
    expect(res.status).toBe(409);
  });

  it.each([
    ['no list', {}, 'tasks must be a list with at least one task'],
    ['an empty list', { tasks: [] }, 'tasks must be a list with at least one task'],
    ['no event id', { tasks: [{ ...lab9, eventId: '' }] }, 'Task 1: eventId must name the calendar event'],
    ['a course that is not theirs', { tasks: [{ ...lab9, courseId: 'nope' }] }, 'Task 1: courseId must be one of your courses'],
    ['an unplaced event (no course)', { tasks: [{ ...lab9, courseId: null }] }, 'Task 1: courseId must be one of your courses'],
    ['a blank title', { tasks: [{ ...lab9, title: '  ' }] }, 'Task 1: title must name the assignment'],
    ['week 16', { tasks: [{ ...lab9, dueWeek: 16 }] }, 'Task 1: dueWeek must be a whole number from 1 to 15'],
    ['hours of 0', { tasks: [{ ...lab9, estimatedHours: 0 }] }, 'Task 1: estimatedHours must be more than 0 and up to 100, or null'],
  ])('refuses %s with a 400, and adds nothing', async (_case, body, error) => {
    const { api } = await appWith();
    const before = (await store.listTasks(userId, {})).length;
    const res = await api.post('/calendar/events').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect((await store.listTasks(userId, {})).length).toBe(before);
    await expect(store.listCalendarImports(userId)).resolves.toEqual([]);
  });

  it('adds nothing when one task of several is bad', async () => {
    const { api } = await appWith();
    const before = (await store.listTasks(userId, {})).length;
    const res = await api.post('/calendar/events').send({ tasks: [lab9, { ...quiz3, dueWeek: 0 }] });
    expect(res.status).toBe(400);
    expect((await store.listTasks(userId, {})).length).toBe(before);
  });
});

describe('the calendar routes in the real app', () => {
  it('need a signed-in student', async () => {
    expect((await request(app).get('/calendar/events')).status).toBe(401);
    expect((await request(app).post('/calendar/events').send({ tasks: [] })).status).toBe(401);
  });
});

describe('the stores keep the imports', () => {
  it('the in-memory store records, replaces by event, and keeps students apart', async () => {
    const memory = new MemoryStore();
    await memory.recordCalendarImports('sam', [{ eventId: 'e1', taskId: 't1', dueWeek: 4 }]);
    await memory.recordCalendarImports('sam', [{ eventId: 'e1', taskId: 't1', dueWeek: 6 }]);
    await expect(memory.listCalendarImports('sam')).resolves.toEqual([{ eventId: 'e1', taskId: 't1', dueWeek: 6 }]);
    await expect(memory.listCalendarImports('alex')).resolves.toEqual([]);
  });

  describe('the Supabase store', () => {
    let calls: { url: URL; method: string; body: unknown }[];
    beforeEach(() => {
      calls = [];
      jest.spyOn(global, 'fetch').mockImplementation(async (input, options) => {
        const url = new URL(String(input));
        const method = options?.method ?? 'GET';
        calls.push({ url, method, body: options?.body ? JSON.parse(String(options.body)) : null });
        const rows = [{ event_uid: 'e1', task_id: 't1', due_week: 4 }];
        return new Response(JSON.stringify(method === 'GET' ? rows : []), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const supabase = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

    it("reads only that student's imports", async () => {
      await expect(supabase().listCalendarImports('alice')).resolves.toEqual([{ eventId: 'e1', taskId: 't1', dueWeek: 4 }]);
      expect(calls[0].url.pathname).toMatch(/calendar_imports$/);
      expect(calls[0].url.searchParams.get('user_id')).toBe('eq.alice');
    });

    it('upserts on the student and event', async () => {
      await supabase().recordCalendarImports('alice', [{ eventId: 'e1', taskId: 't1', dueWeek: 4 }]);
      const write = calls.find((c) => c.method === 'POST')!;
      expect(write.url.searchParams.get('on_conflict')).toBe('user_id,event_uid');
      expect(write.body).toEqual([{ user_id: 'alice', event_uid: 'e1', task_id: 't1', due_week: 4 }]);
    });

    it('sends nothing when there is nothing to record', async () => {
      await supabase().recordCalendarImports('alice', []);
      expect(calls).toHaveLength(0);
    });
  });
});
