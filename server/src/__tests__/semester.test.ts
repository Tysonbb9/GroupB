import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';

beforeEach(() => resetDb());

describe('GET /semester', () => {
  it('returns the whole semester', async () => {
    const res = await request(app).get('/semester');
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Fall 2026');
    expect(res.body.courses).toHaveLength(5);
    expect(res.body.tasks).toHaveLength(36);
  });
});