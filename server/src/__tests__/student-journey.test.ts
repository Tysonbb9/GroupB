import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

/**
 * End to end through the real app: real sign-up and sessions (Better Auth),
 * the real routes and the in-memory store, the way the phone uses them. Each
 * test follows one student from signing up, so a break anywhere along the
 * way (login, the semester, adding work, finishing it, hours, reviews, the
 * calendar link, signing out) shows up here even when each piece passes on
 * its own. No real network: the calendar link is refused before any fetch.
 */

const ORIGIN = 'http://localhost:8081'; // Expo Web, the only origin allowed cookies
let students = 0;

/** Signs a new student up, as the phone's sign-up screen does, and returns their session. */
async function signUp(name = 'Sam Student') {
  students += 1;
  const agent = request.agent(app);
  const email = `journey${students}@example.com`;
  const res = await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ name, email, password: 'journey-password-1' });
  expect(res.status).toBe(200);
  return { agent, email };
}

beforeEach(() => resetDb());

describe("a new student's first session", () => {
  it('starts empty, loads the sample semester, and sees it on every read', async () => {
    const { agent } = await signUp();

    const empty = await agent.get('/semester');
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ courses: [], tasks: [], weekHours: [] });

    const loaded = await agent.post('/semester/sample');
    expect(loaded.status).toBe(201);
    expect(loaded.body.courses).toHaveLength(5);
    expect(loaded.body.tasks).toHaveLength(36);

    // The same semester from every read route.
    expect((await agent.get('/semester')).body.tasks).toHaveLength(36);
    expect((await agent.get('/courses')).body).toHaveLength(5);
    expect((await agent.get('/tasks')).body).toHaveLength(36);
    expect((await agent.get('/tasks?courseId=cs262')).body.every((t: { courseId: string }) => t.courseId === 'cs262')).toBe(true);

    // Loading it twice is refused, so a double tap cannot copy it twice.
    expect((await agent.post('/semester/sample')).status).toBe(409);
  });
});

describe('a week of work, end to end', () => {
  it('adds work, estimates it, moves it, finishes it and reports the hours, and every read agrees', async () => {
    const { agent } = await signUp();
    await agent.post('/semester/sample');

    // US-30: assignments reviewed from a syllabus are added all at once.
    const added = await agent.post('/tasks').send({
      tasks: [
        { courseId: 'cs262', title: 'Design doc', dueWeek: 5, estimatedHours: null },
        { courseId: 'cs262', title: 'Code review', dueWeek: 6, estimatedHours: 2 },
      ],
    });
    expect(added.status).toBe(201);
    const [doc, review] = added.body;
    expect((await agent.get('/tasks')).body).toHaveLength(38);

    // US-12 and US-44: estimate it, then move its due week on the details screen.
    expect((await agent.patch(`/tasks/${doc.id}`).send({ estimatedHours: 4 })).body.estimatedHours).toBe(4);
    expect((await agent.patch(`/tasks/${doc.id}`).send({ dueWeek: 7 })).body.dueWeek).toBe(7);

    // US-08: finish it; US-31: undo; finish again.
    expect((await agent.patch(`/tasks/${review.id}`).send({ done: true })).body.done).toBe(true);
    expect((await agent.patch(`/tasks/${review.id}`).send({ done: false })).body.done).toBe(false);
    await agent.patch(`/tasks/${review.id}`).send({ done: true });

    // US-23: say how long it took, which is kept for other students.
    const saved = await agent.post('/courses/cs262/reviews').send({ title: 'Code review', hours: 3 });
    expect(saved.status).toBe(201);
    expect((await agent.get('/courses/cs262/reviews')).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Code review', hours: 3 })])
    );

    // Every read agrees on what happened.
    const semester = (await agent.get('/semester')).body;
    const byId = (id: string) => semester.tasks.find((t: { id: string }) => t.id === id);
    expect(byId(doc.id)).toMatchObject({ estimatedHours: 4, dueWeek: 7, done: false });
    expect(byId(review.id)).toMatchObject({ done: true });
    expect((await agent.get('/tasks?done=true')).body.map((t: { id: string }) => t.id)).toContain(review.id);
    expect((await agent.get('/tasks?week=7')).body.map((t: { id: string }) => t.id)).toContain(doc.id);
  });

  it('changes the hours it has, for every week and for one week, and both are kept', async () => {
    const { agent } = await signUp();
    await agent.post('/semester/sample');

    expect((await agent.patch('/semester').send({ weeklyCapacity: 20 })).body.weeklyCapacity).toBe(20); // US-32
    expect((await agent.patch('/semester/weeks/6').send({ hours: 30 })).body).toEqual([{ week: 6, hours: 30 }]); // #148

    const semester = (await agent.get('/semester')).body;
    expect(semester.weeklyCapacity).toBe(20);
    expect(semester.weekHours).toEqual([{ week: 6, hours: 30 }]);

    // A sample loaded later never overwrites hours the student chose.
    expect((await agent.post('/semester/sample')).status).toBe(409);
    expect((await agent.get('/semester')).body.weeklyCapacity).toBe(20);
  });

  it('keeps the calendar link checks between the student and other sites', async () => {
    const { agent } = await signUp();
    await agent.post('/semester/sample');

    expect((await agent.get('/calendar/link')).body).toEqual({ saved: false, savedAt: null });
    const refused = await agent.post('/calendar/link').send({ url: 'https://example.com/calendar.ics' });
    expect(refused.status).toBe(400);
    expect((await agent.get('/calendar/events')).status).toBe(409); // nothing saved, so nothing to read
    expect((await agent.get('/calendar/changes')).status).toBe(409);
  });

  it('gets no reminder and no check-in question with no AI set up, and the app still works', async () => {
    const { agent } = await signUp();
    await agent.post('/semester/sample');
    expect((await agent.post('/reminders')).body).toEqual({ reminder: null });
    expect((await agent.get('/checkin')).body).toEqual({ question: null });
    expect((await agent.get('/semester')).status).toBe(200);
  });
});

describe('two students side by side', () => {
  it('never see or change each other’s work, hours or links', async () => {
    const sam = await signUp('Sam');
    const alex = await signUp('Alex');
    await sam.agent.post('/semester/sample');
    await alex.agent.post('/semester/sample');

    const added = await sam.agent.post('/tasks').send({
      tasks: [{ courseId: 'cs262', title: 'Only Sam', dueWeek: 4, estimatedHours: 1 }],
    });
    const samTask = added.body[0];
    await sam.agent.patch('/semester').send({ weeklyCapacity: 30 });
    await sam.agent.patch('/semester/weeks/5').send({ hours: 40 });
    await sam.agent.patch('/tasks/m-1').send({ done: true });

    const alexSemester = (await alex.agent.get('/semester')).body;
    expect(alexSemester.tasks.some((t: { title: string }) => t.title === 'Only Sam')).toBe(false);
    expect(alexSemester.weeklyCapacity).toBe(15);
    expect(alexSemester.weekHours).toEqual([]);
    expect(alexSemester.tasks.find((t: { id: string }) => t.id === 'm-1').done).toBe(false);

    // Alex cannot read or change Sam's task, even knowing its id.
    expect((await alex.agent.get(`/tasks/${samTask.id}`)).status).toBe(404);
    expect((await alex.agent.patch(`/tasks/${samTask.id}`).send({ done: true })).status).toBe(404);
    expect((await sam.agent.get(`/tasks/${samTask.id}`)).body.done).toBe(false);
  });
});

describe('signing out', () => {
  it('ends the session: the next request is refused, and signing back in restores the same semester', async () => {
    const { agent, email } = await signUp();
    await agent.post('/semester/sample');
    await agent.patch('/semester').send({ weeklyCapacity: 25 });

    const out = await agent.post('/api/auth/sign-out').set('Origin', ORIGIN).send({});
    expect(out.status).toBe(200);
    expect((await agent.get('/semester')).status).toBe(401);

    const back = request.agent(app);
    const signedIn = await back.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'journey-password-1' });
    expect(signedIn.status).toBe(200);
    const semester = (await back.get('/semester')).body;
    expect(semester.weeklyCapacity).toBe(25);
    expect(semester.tasks).toHaveLength(36);
  });

  it('refuses a wrong password, and every student route without a session', async () => {
    const { email } = await signUp();
    const wrong = await request(app).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'not-it-at-all' });
    expect(wrong.status).toBe(401);

    for (const [method, path] of [
      ['get', '/semester'],
      ['get', '/tasks'],
      ['patch', '/tasks/m-1'],
      ['post', '/tasks'],
      ['patch', '/semester'],
      ['patch', '/semester/weeks/3'],
      ['get', '/calendar/link'],
      ['post', '/reminders'],
      ['get', '/checkin'],
    ] as const) {
      expect((await request(app)[method](path).send({})).status).toBe(401);
    }
  });
});
