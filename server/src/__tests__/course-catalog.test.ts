import request from 'supertest';
import { app } from '../app';
import { db, resetDb } from '../data/db';
import { signedIn, type Api } from '../testing/session';

let a: Api;
let b: Api;
beforeAll(async () => { a = await signedIn(); b = await signedIn(); });
beforeEach(() => resetDb());

it.each(['cs262', 'CS 262', 'cs-262', 'CS.262', 'cs_262'])('finds the same catalog course for %s', async query => {
  const response = await a.get('/catalog').query({ q: query });
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ id: 'cs262', enrolled: false });
  expect((await a.get('/courses')).body).toEqual([]);
});

it.each([undefined, '', '   ', '\0'])('refuses an unusable query %p', async q => {
  const response = await a.get('/catalog').query(q === undefined ? {} : { q });
  expect(response.status).toBe(400);
  expect(response.body.error).toEqual(expect.any(String));
});

it('searches names without case sensitivity and marks enrollment for the caller only', async () => {
  expect((await a.post('/courses/cs262/enroll')).status).toBe(200);
  expect((await a.get('/catalog').query({ q: 'SOFTWARE' })).body[0]).toMatchObject({ id: 'cs262', enrolled: true });
  expect((await b.get('/catalog').query({ q: 'software' })).body[0]).toMatchObject({ id: 'cs262', enrolled: false });
  expect((await a.get('/courses')).body.map((course: { id: string }) => course.id)).toEqual(['cs262']);
  expect((await a.get('/semester')).body.courses).toHaveLength(1);
  expect((await b.get('/semester')).body.courses).toEqual([]);
  expect((await a.post('/courses/cs262/enroll')).status).toBe(200);
  expect(db.enrollments).toHaveLength(1);
});

it('returns 404 for an unknown course without enrolling', async () => {
  expect((await a.post('/courses/missing/enroll')).status).toBe(404);
  expect(db.enrollments).toHaveLength(0);
});

it('creates a trimmed course, enrolls its creator and exposes no internal key', async () => {
  const response = await a.post('/courses').send({ code: ' CS 999 ', name: ' New subject ' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual({ id: 'cs999', code: 'CS 999', name: 'New subject', attendance: null });
  expect((await a.get('/courses')).body).toEqual([response.body]);
  expect((await b.get('/courses')).body).toEqual([]);
});

it('returns an existing course for a duplicate without changing the catalog or enrollment', async () => {
  const response = await a.post('/courses').send({ code: 'cs-262', name: 'Different title' });
  expect(response.status).toBe(409);
  expect(response.body.course).toMatchObject({ id: 'cs262', name: 'Software Engineering' });
  expect(response.body.error).toEqual(expect.any(String));
  expect(db.courses).toHaveLength(5);
  expect(db.enrollments).toHaveLength(0);
});

it('simultaneous duplicate creates leave one course and enroll only its creator', async () => {
  const results = await Promise.all([
    a.post('/courses').send({ code: 'CS 999', name: 'First title' }),
    b.post('/courses').send({ code: 'cs-999', name: 'Second title' }),
  ]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  expect(db.courses).toHaveLength(6);
  expect(db.enrollments).toHaveLength(1);
  expect(results.find(result => result.status === 409)!.body.course.id).toBe(results.find(result => result.status === 201)!.body.id);
});

it('uses a suffix when a readable id is already taken by a different code', async () => {
  const response = await a.post('/courses').send({ code: 'CS/262', name: 'Separate subject' });
  expect(response.status).toBe(201);
  expect(response.body.id).toBe('cs262-2');
});

it('ranks exact code then prefix then other matches and returns no more than ten', async () => {
  for (let i = 0; i < 12; i++) await a.post('/courses').send({ code: `ZZ${i}`, name: 'CS262 related' });
  await a.post('/courses').send({ code: 'CS 2620', name: 'Advanced subject' });
  const response = await a.get('/catalog').query({ q: 'cs262' });
  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(10);
  expect(response.body.slice(0, 2).map((course: { id: string }) => course.id)).toEqual(['cs262', 'cs2620']);
});

it.each([
  {}, { code: '', name: 'Subject' }, { code: '._- ', name: 'Subject' },
  { code: 'X', name: ' ' }, { code: 262, name: 'Subject' }, { code: 'X', name: null },
  { code: 'A'.repeat(41), name: 'Subject' }, { code: 'X', name: 'N'.repeat(201) },
])('refuses invalid course input %p without creating or enrolling', async input => {
  expect((await a.post('/courses').send(input)).status).toBe(400);
  expect(db.courses).toHaveLength(5);
  expect(db.enrollments).toHaveLength(0);
});

it('accepts the code and name limits exactly', async () => {
  expect((await a.post('/courses').send({ code: 'A'.repeat(40), name: 'N'.repeat(200) })).status).toBe(201);
});

it('treats punctuation in a search as literal text rather than a wildcard', async () => {
  for (const q of ['%', '_', '.', ',']) {
    const response = await a.get('/catalog').query({ q });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  }
});

it('requires a session for catalog search, joining and creation', async () => {
  expect((await request(app).get('/catalog').query({ q: 'cs262' })).status).toBe(401);
  expect((await request(app).post('/courses/cs262/enroll')).status).toBe(401);
  expect((await request(app).post('/courses').send({ code: 'CS999', name: 'Subject' })).status).toBe(401);
});

it('counts Unicode characters at the same limits as the database', async () => {
  expect((await a.post('/courses').send({ code: '😀'.repeat(40), name: '😀'.repeat(200) })).status).toBe(201);
  expect((await b.post('/courses').send({ code: '😀'.repeat(41), name: 'Subject' })).status).toBe(400);
});
