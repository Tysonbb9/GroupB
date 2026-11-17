import express from 'express';
import request from 'supertest';
import { app } from '../app';
import type { ModelClient } from '../ai/model';
import { reminderRouter } from '../ai/reminder-routes';
import { ReminderLog } from '../ai/reminders';
import { resetDb } from '../data/db';
import { MemoryStore } from '../data/memory-store';
import { signedIn } from '../testing/session';

/**
 * #156: POST /reminders. Like checkin-routes.test.ts, the router is mounted
 * on a small app of its own, with a pretend signed-in student, a fake model
 * and a fixed clock. The real app's login check is tested at the bottom.
 *
 * The sample semester is in week 3. Due this week with hours: Problem set 1
 * (3h), Homework 1, Vision statement and Reading response 1 (2h each). Next
 * week: Prototype demo (6h) and Lab 2 (3h).
 */

const model: ModelClient = { complete: jest.fn(async () => 'never called') };
const store = new MemoryStore();
let students = 0;
let userId = '';
let clock = new Date('2026-11-16T09:00:00Z');

async function appWith(modelClient: ModelClient | null, log = new ReminderLog()) {
  students += 1;
  userId = `student-${students}`;
  await store.loadSample(userId);
  const small = express();
  small.use(express.json());
  small.use((_req, res, next) => {
    res.locals.session = { user: { id: userId } }; // what app.ts's login check puts here
    next();
  });
  small.use('/reminders', reminderRouter(store, modelClient, log, () => clock));
  return request.agent(small);
}

beforeEach(() => {
  resetDb();
  clock = new Date('2026-11-16T09:00:00Z');
});

describe('POST /reminders', () => {
  it('gives no reminder when there is no model (no key), so the app works as before', async () => {
    const res = await (await appWith(null)).post('/reminders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reminder: null });
  });

  it('gives the soonest open assignment, with the count for today', async () => {
    const res = await (await appWith(model)).post('/reminders');
    expect(res.status).toBe(200);
    expect(res.body.reminder).toEqual({
      taskId: 'm-1',
      courseId: 'math251',
      code: 'MATH 251',
      title: 'Problem set 1',
      text: 'Finish it this week: 3 hours, due week 3.',
      countToday: 1,
      maxPerDay: 2,
    });
  });

  it('never asks the model: the first version uses a fixed sentence', async () => {
    const complete = jest.fn(async () => 'unused');
    await (await appWith({ complete })).post('/reminders');
    expect(complete).not.toHaveBeenCalled();
  });

  it('gives a different assignment the second time', async () => {
    const api = await appWith(model);
    const first = (await api.post('/reminders')).body.reminder;
    const second = (await api.post('/reminders')).body.reminder;
    expect(second.taskId).not.toBe(first.taskId);
    expect(second.countToday).toBe(2);
  });

  it('gives nothing a third time the same day', async () => {
    const api = await appWith(model);
    await api.post('/reminders');
    await api.post('/reminders');
    const third = await api.post('/reminders');
    expect(third.status).toBe(200);
    expect(third.body).toEqual({ reminder: null });
  });

  it('gives one again the next day, about something new', async () => {
    const api = await appWith(model);
    const seen = [(await api.post('/reminders')).body.reminder.taskId, (await api.post('/reminders')).body.reminder.taskId];
    clock = new Date('2026-11-17T09:00:00Z');
    const next = (await api.post('/reminders')).body.reminder;
    expect(next).toMatchObject({ countToday: 1 });
    expect(seen).not.toContain(next.taskId);
  });

  it('skips work that is done', async () => {
    const api = await appWith(model);
    await store.updateTask(userId, 'm-1', { done: true });
    expect((await api.post('/reminders')).body.reminder.taskId).not.toBe('m-1');
  });

  it('gives nothing to a student with no tasks', async () => {
    students += 1;
    userId = `empty-${students}`;
    const small = express();
    small.use((_req, res, next) => {
      res.locals.session = { user: { id: userId } };
      next();
    });
    small.use('/reminders', reminderRouter(store, model, new ReminderLog(), () => clock));
    const res = await request(small).post('/reminders');
    expect(res.body).toEqual({ reminder: null });
  });
});

describe('POST /reminders in the real app', () => {
  it('needs a signed-in student', async () => {
    const res = await request(app).post('/reminders');
    expect(res.status).toBe(401);
  });

  it('answers a signed-in student, with null when no AI is set up', async () => {
    const api = await signedIn();
    const res = await api.post('/reminders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reminder: null });
  });
});
