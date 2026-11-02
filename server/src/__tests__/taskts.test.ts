import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

beforeEach(() => resetDb());

describe('GET /tasks', () => {
  it('returns every task when no filters are given', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(36);
  });

  it('filters by courseId', async () => {
    const res = await request(app).get('/tasks?courseId=cs262');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    // every task that came back belongs to CS 262
    for (const task of res.body) {
      expect(task.courseId).toBe('cs262');
    }
  });

  it.todo('filters by week');                 // ?week=7, check every dueWeek is 7
  it.todo('filters by done');                 // ?done=true should give 2 tasks
  it.todo('combines filters');                // ?courseId=cs262&week=4&done=false gives only 262-3
  it.todo('returns 400 when week is not a number');  // ?week=abc
  it.todo('returns 400 when done is not true or false'); // ?done=maybe
});

describe('GET /tasks/:id', () => {
  it.todo('returns the task when the id exists'); // 262-2 is 'Vision statement'
  it.todo('returns 404 for an unknown id');
});

describe('PATCH /tasks/:id', () => {
  it('marks a task done, and the change sticks', async () => {
    const patch = await request(app).patch('/tasks/262-2').send({ done: true });
    expect(patch.status).toBe(200);
    expect(patch.body.done).toBe(true);

    // ask again to prove the "database" really changed
    const get = await request(app).get('/tasks/262-2');
    expect(get.body.done).toBe(true);
  });

  it.todo('sets estimatedHours');                    // send { estimatedHours: 4 }
  it.todo('clears estimatedHours with null');         // send { estimatedHours: null }
  it.todo('returns 400 when done is not a boolean');  // send { done: 'yes' }
  it.todo('returns 400 when estimatedHours is negative'); // send { estimatedHours: -1 }
  it.todo('does not change anything when the request is invalid'); // send { done: true, estimatedHours: -1 }, then GET and check done is still false
  it.todo('returns 404 for an unknown id');

  // TP-25 and TP-26 (risk R1): the same limits as the client (MAX_ESTIMATE_HOURS)
  // and the database CHECK in server/db/schema.sql, so the database never
  // rejects what the API accepted.
  it('accepts estimatedHours of exactly 100', async () => {
    const res = await request(app).patch('/tasks/262-2').send({ estimatedHours: 100 });
    expect(res.status).toBe(200);
    expect(res.body.estimatedHours).toBe(100);
  });

  it.each([[0], [100.5], [101]])('returns 400 when estimatedHours is %p', async (hours) => {
    const res = await request(app).patch('/tasks/262-2').send({ estimatedHours: hours });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estimatedHours/);

    // the task keeps its old estimate
    const get = await request(app).get('/tasks/262-2');
    expect(get.body.estimatedHours).toBe(2);
  });
});
