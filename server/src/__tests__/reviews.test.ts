import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

// Every test starts with no reviews.
beforeEach(() => resetDb());

describe('POST /courses/:id/reviews', () => {
  it('saves a review and returns it with 201', async () => {
    const res = await request(app)
      .post('/courses/cs262/reviews')
      .send({ title: 'Sprint 1 review', hours: 6, comment: 'Start early' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      courseId: 'cs262',
      title: 'Sprint 1 review',
      hours: 6,
      comment: 'Start early',
    });
    expect(res.body.id).toBeDefined();
  });

  it('can be read back with GET', async () => {
    await request(app).post('/courses/cs262/reviews').send({ title: 'Sprint 1 review', hours: 6 });

    const res = await request(app).get('/courses/cs262/reviews');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].comment).toBe('');
  });

  it('rejects a review with no assignment title', async () => {
    const res = await request(app).post('/courses/cs262/reviews').send({ hours: 6 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('returns 404 for an unknown course', async () => {
    const res = await request(app).post('/courses/nope/reviews').send({ title: 'Quiz', hours: 2 });
    expect(res.status).toBe(404);
  });

  it('rejects zero hours', async () => {
    const res = await request(app).post('/courses/cs262/reviews').send({ title: 'Quiz', hours: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hours/);
  });
});

describe('GET /courses/:id/reviews', () => {
  it('returns an empty list when nobody has reviewed the course', async () => {
    const res = await request(app).get('/courses/math251/reviews');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});