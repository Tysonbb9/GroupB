import request from 'supertest';
import { app } from '../app';
import { semester } from '../data/semester';
import { db, resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

let a: Api;
let b: Api;
beforeAll(async () => {
  a = await signedIn();
  b = await signedIn();
});
beforeEach(() => resetDb());

async function sample(api: Api) {
  const response = await api.post('/semester/sample');
  expect(response.status).toBe(201);
  return response.body;
}

test('a new account starts empty with fifteen weekly hours', async () => {
  const response = await a.get('/semester');
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ courses: [], tasks: [], weeklyCapacity: 15 });
});

test('sample enrollment belongs to one student and a second load is refused', async () => {
  const semester = await sample(a);
  expect(semester.courses).toHaveLength(5);
  expect(semester.tasks).toHaveLength(36);
  expect(semester.weeklyCapacity).toBe(15);
  expect((await b.get('/semester')).body).toMatchObject({ courses: [], tasks: [] });
  expect((await a.post('/semester/sample')).status).toBe(409);
  expect((await a.get('/tasks')).body).toHaveLength(36);
});

test('each student can tick and estimate the same sample task independently', async () => {
  await sample(a);
  await sample(b);
  const original = (await b.get('/tasks/262-2')).body;
  expect((await a.patch('/tasks/262-2').send({ done: true, estimatedHours: 9 })).status).toBe(200);
  expect((await a.get('/tasks/262-2')).body).toMatchObject({ done: true, estimatedHours: 9 });
  expect((await b.get('/tasks/262-2')).body).toEqual(original);
  expect((await b.get('/tasks?done=true')).body.some((task: { id: string }) => task.id === '262-2')).toBe(false);
});

test('weekly capacity belongs to the signed-in student', async () => {
  expect((await a.patch('/semester').send({ weeklyCapacity: 27 })).status).toBe(200);
  expect((await a.get('/semester')).body.weeklyCapacity).toBe(27);
  expect((await b.get('/semester')).body.weeklyCapacity).toBe(15);
  await sample(a);
  expect((await a.get('/semester')).body.weeklyCapacity).toBe(15);
});

test('another student cannot read or change a task they do not own', async () => {
  await sample(b);
  expect((await a.get('/tasks/262-2')).status).toBe(404);
  expect((await a.patch('/tasks/262-2').send({ done: true })).status).toBe(404);
  expect((await a.get('/tasks?courseId=cs262')).body).toEqual([]);
  expect((await b.get('/tasks/262-2')).body.done).toBe(false);
});

test('a shared catalog course is hidden unless the student is enrolled', async () => {
  await sample(b);
  expect((await a.get('/courses')).body).toEqual([]);
  expect((await a.get('/courses/cs262')).status).toBe(404);
  expect((await a.post('/tasks').send({ tasks: [{ courseId: 'cs262', title: 'Private work', dueWeek: 7, estimatedHours: 2 }] })).status).toBe(400);
});

test('new task ids use each student own namespace', async () => {
  await sample(a);
  await sample(b);
  const task = { tasks: [{ courseId: 'cs262', title: 'Extra work', dueWeek: 7, estimatedHours: 2 }] };
  const first = await a.post('/tasks').send(task);
  const second = await b.post('/tasks').send(task);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(first.body[0].id).toBe(second.body[0].id);
  await a.patch(`/tasks/${first.body[0].id}`).send({ done: true });
  expect((await b.get(`/tasks/${second.body[0].id}`)).body.done).toBe(false);
});

test('concurrent sample requests add just one copy', async () => {
  const responses = await Promise.all([a.post('/semester/sample'), a.post('/semester/sample')]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  expect((await a.get('/semester')).body.tasks).toHaveLength(36);
});

test('sample loading requires a signed-in account', async () => {
  expect((await request(app).post('/semester/sample')).status).toBe(401);
});

test('an enrollment alone prevents replacing a student semester with the sample', async () => {
  const { body } = await a.get('/api/auth/get-session');
  db.enrollments.push({ userId: body.user.id, courseId: 'cs262' });
  expect((await a.post('/semester/sample')).status).toBe(409);
  expect((await a.get('/tasks')).body).toEqual([]);
});

test('a task alone also prevents replacing a student semester with the sample', async () => {
  const { body } = await a.get('/api/auth/get-session');
  db.tasks.push({ ...semester.tasks[0], userId: body.user.id });
  expect((await a.post('/semester/sample')).status).toBe(409);
  expect((await a.get('/courses')).body).toEqual([]);
});
