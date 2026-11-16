import express from 'express';
import request from 'supertest';
import { app } from '../app';
import { checkinRouter } from '../ai/checkin-routes';
import type { ModelClient } from '../ai/model';
import { resetDb } from '../data/db';
import { MemoryStore } from '../data/memory-store';
import { signedIn } from '../testing/session';

/**
 * #155: GET and POST /checkin. The model is always a fake here, never a real
 * one: each test says what the "model" answers. Like ai-routes.test.ts, the
 * router is mounted on a small app of its own, with a pretend signed-in
 * student, and the real app's login check is tested at the bottom.
 */

/** A fake model that always answers with this text, and remembers each prompt. */
function fakeModel(answer: unknown) {
  const complete = jest.fn(async (_prompt: string) => (typeof answer === 'string' ? answer : JSON.stringify(answer)));
  const model: ModelClient = { complete };
  return { model, complete };
}

/** The JSON snapshot on the last line of the prompt the fake model was sent. */
function snapshotSent(complete: jest.Mock) {
  const prompt: string = complete.mock.calls[0][0];
  return JSON.parse(prompt.split('\n').pop()!);
}

let students = 0;

/** The check-in routes with this model, for a new student nobody has asked yet. */
function appWith(model: ModelClient | null) {
  students += 1;
  const userId = `student-${students}`;
  const small = express();
  small.use(express.json());
  small.use((_req, res, next) => {
    res.locals.session = { user: { id: userId } }; // what app.ts's login check puts here
    next();
  });
  small.use('/checkin', checkinRouter(new MemoryStore(), model));
  return request.agent(small);
}

beforeEach(() => resetDb());

describe('GET /checkin', () => {
  it('asks nothing when there is no model (no key), so the app works as before', async () => {
    const res = await appWith(null).get('/checkin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ question: null });
  });

  it('asks about the course the model picked, in words code wrote', async () => {
    const api = appWith(fakeModel({ courseId: 'cs262', reason: 'The team board moved the demo.' }).model);

    const res = await api.get('/checkin');
    expect(res.status).toBe(200);
    expect(res.body.question).toEqual({
      courseId: 'cs262',
      code: 'CS 262',
      text: 'Is CS 262 still on schedule?',
      reason: 'The team board moved the demo.',
    });
  });

  it('shows the model a snapshot built by code: the week and each course with its open tasks', async () => {
    const { model, complete } = fakeModel({ courseId: 'cs262' });
    await appWith(model).get('/checkin');

    const snapshot = snapshotSent(complete);
    expect(snapshot.currentWeek).toBe(3);
    const cs262 = snapshot.courses.find((c: { courseId: string }) => c.courseId === 'cs262');
    expect(cs262.lastConfirmed).toBeNull();
    expect(cs262.openTasks.length).toBeGreaterThan(0);
  });

  it("drops a course that is not one of the student's", async () => {
    const res = await appWith(fakeModel({ courseId: 'hack101', reason: 'Trust me' }).model).get('/checkin');
    expect(res.body).toEqual({ question: null });
  });

  it('asks nothing, and does not fail, when the model call throws or its answer is not JSON', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const throws: ModelClient = { complete: async () => { throw new Error('model down'); } };

    for (const model of [throws, fakeModel('Sure! CS 262.').model]) {
      const res = await appWith(model).get('/checkin');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ question: null });
    }
  });

  it('does not ask again about a course the student just answered', async () => {
    const { model, complete } = fakeModel({ courseId: 'cs262' });
    const api = appWith(model);
    await api.post('/checkin').send({ courseId: 'cs262', answer: 'on-schedule' });

    await api.get('/checkin');
    const ids = snapshotSent(complete).courses.map((c: { courseId: string }) => c.courseId);
    expect(ids).not.toContain('cs262');
  });
});

describe('POST /checkin', () => {
  it('saves "Yes, still accurate" with the time it was answered', async () => {
    const res = await appWith(null).post('/checkin').send({ courseId: 'cs262', answer: 'on-schedule' });

    expect(res.status).toBe(200);
    expect(res.body.checkin).toMatchObject({ courseId: 'cs262', answer: 'on-schedule' });
    expect(Date.parse(res.body.checkin.answeredAt)).not.toBeNaN();
    expect(res.body.tasks).toEqual([]);
  });

  it('saves "Something changed" with the new week and hours of a task', async () => {
    const store = new MemoryStore();
    const res = await appWith(null).post('/checkin').send({
      courseId: 'cs262',
      answer: 'changed',
      changes: [{ taskId: '262-2', dueWeek: 5, estimatedHours: 3 }],
    });

    expect(res.status).toBe(200);
    expect(res.body.tasks[0]).toMatchObject({ id: '262-2', dueWeek: 5, estimatedHours: 3 });
    expect(await store.getTask('262-2')).toMatchObject({ dueWeek: 5, estimatedHours: 3 });
  });

  it('changes nothing when any one change is invalid (all or nothing)', async () => {
    const res = await appWith(null).post('/checkin').send({
      courseId: 'cs262',
      answer: 'changed',
      changes: [
        { taskId: '262-2', dueWeek: 5, estimatedHours: 3 },
        { taskId: '262-2', dueWeek: 16, estimatedHours: 3 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Change 2/);
    expect((await new MemoryStore().getTask('262-2'))?.dueWeek).toBe(3);
  });

  it.each([
    ['an answer that is not one of the three', { courseId: 'cs262', answer: 'maybe' }, /answer/],
    ['"changed" with no changes', { courseId: 'cs262', answer: 'changed' }, /changes/],
    ['changes with "on-schedule"', { courseId: 'cs262', answer: 'on-schedule', changes: [] }, /changes/],
    ['a task from another course', { courseId: 'cs262', answer: 'changed', changes: [{ taskId: '336-1', dueWeek: 5, estimatedHours: 3 }] }, /taskId/],
    ['zero hours', { courseId: 'cs262', answer: 'changed', changes: [{ taskId: '262-2', dueWeek: 5, estimatedHours: 0 }] }, /estimatedHours/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const res = await appWith(null).post('/checkin').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('returns 404 for an unknown course', async () => {
    const res = await appWith(null).post('/checkin').send({ courseId: 'nope', answer: 'on-schedule' });
    expect(res.status).toBe(404);
  });
});

describe('/checkin in the real app', () => {
  it('needs a signed-in student', async () => {
    const res = await request(app).get('/checkin');
    expect(res.status).toBe(401);
  });

  it('asks nothing when the server has no AI_* settings (as in these tests)', async () => {
    const api = await signedIn();
    const res = await api.get('/checkin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ question: null });
  });
});
