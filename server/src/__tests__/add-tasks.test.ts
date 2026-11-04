import request from 'supertest';
import { app } from '../app';
import { db, resetDb } from '../data/db';

// Every test starts from the same sample semester.
beforeEach(() => resetDb());

const labReport = { courseId: 'cs262', title: 'Lab report', dueWeek: 4, estimatedHours: 3 };
const finalProject = { courseId: 'cs262', title: 'Final project', dueWeek: 9, estimatedHours: null };

describe('POST /tasks (US-30: add the reviewed assignments)', () => {
  it('adds every task and returns them with ids and 201', async () => {
    const res = await request(app).post('/tasks').send({ tasks: [labReport, finalProject] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ ...labReport, done: false });
    expect(res.body[1]).toMatchObject({ ...finalProject, done: false });
    expect(res.body[0].id).toBeDefined();
    expect(res.body[0].id).not.toBe(res.body[1].id);
  });

  it('saves them, so GET /tasks shows them afterwards', async () => {
    const before = db.tasks.length;
    await request(app).post('/tasks').send({ tasks: [labReport] });

    const res = await request(app).get('/tasks?courseId=cs262');
    expect(db.tasks).toHaveLength(before + 1);
    expect(res.body.map((t: { title: string }) => t.title)).toContain('Lab report');
  });

  it('gives ids that no other task is using', async () => {
    const first = await request(app).post('/tasks').send({ tasks: [labReport] });
    const second = await request(app).post('/tasks').send({ tasks: [labReport] });

    const ids = db.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(first.body[0].id).not.toBe(second.body[0].id);
  });

  it('trims the title', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ tasks: [{ ...labReport, title: '  Lab report  ' }] });
    expect(res.body[0].title).toBe('Lab report');
  });

  it.each([
    ['no tasks list', {}],
    ['an empty list', { tasks: [] }],
    ['an unknown course', { tasks: [{ ...labReport, courseId: 'nope' }] }],
    ['a blank title', { tasks: [{ ...labReport, title: '   ' }] }],
    ['week 0', { tasks: [{ ...labReport, dueWeek: 0 }] }],
    ['week 16', { tasks: [{ ...labReport, dueWeek: 16 }] }],
    ['week 4.5', { tasks: [{ ...labReport, dueWeek: 4.5 }] }],
    ['0 hours', { tasks: [{ ...labReport, estimatedHours: 0 }] }],
    ['101 hours', { tasks: [{ ...labReport, estimatedHours: 101 }] }],
    ['hours as text', { tasks: [{ ...labReport, estimatedHours: '3' }] }],
  ])('rejects %s with 400 and a message', async (_name, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('adds nothing when any one task is invalid', async () => {
    const before = db.tasks.length;
    const res = await request(app)
      .post('/tasks')
      .send({ tasks: [labReport, { ...finalProject, dueWeek: 20 }] });

    expect(res.status).toBe(400);
    expect(db.tasks).toHaveLength(before);
  });
});
