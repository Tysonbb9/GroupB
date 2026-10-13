import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

// Start every test from the same mock data.
beforeEach(() => resetDb());

describe('GET /courses', () => {
  it('returns all five courses', async () => {
    const res = await request(app).get('/courses');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });
});

describe('GET /courses/:id', () => {
  it('returns the course when the id exists', async () => {
    const res = await request(app).get('/courses/cs262');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Software Engineering');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/courses/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Course not found');
  });
});
