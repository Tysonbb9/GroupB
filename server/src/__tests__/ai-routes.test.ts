import express from 'express';
import request from 'supertest';
import { ModelClient, ModelError } from '../ai/model';
import { aiRouter } from '../ai/routes';
import { MAX_SYLLABUS_CHARS } from '../ai/syllabus-reading';
import { signedIn } from '../testing/session';

/**
 * The AI routes (issue #145), with a fake model: no service is called. The
 * router is mounted on a small app of its own, so the session check in
 * app.ts is tested separately at the bottom.
 */

const GOOD = JSON.stringify({
  assignments: [{ title: 'Prototype demo', dueWeek: 4, estimatedHours: 6 }],
  weights: [{ label: 'Exams', percent: 30 }],
  policies: { absencesAllowed: 4, dropRule: 'Lowest quiz dropped' },
});

function appWith(model: ModelClient | null) {
  const app = express();
  app.use(express.json());
  app.use('/ai', aiRouter(model));
  return app;
}

const fake = (answer: string | Error): ModelClient => ({
  complete: jest.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  }),
});

describe('GET /ai/status', () => {
  it('says unavailable when the server has no model', async () => {
    const res = await request(appWith(null)).get('/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  it('says available when it has one', async () => {
    const res = await request(appWith(fake(GOOD))).get('/ai/status');
    expect(res.body).toEqual({ available: true });
  });
});

describe('POST /ai/syllabus', () => {
  it('returns the checked reading', async () => {
    const res = await request(appWith(fake(GOOD))).post('/ai/syllabus').send({ text: 'Week 4: Prototype demo (6 hours)' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      assignments: [{ title: 'Prototype demo', dueWeek: 4, estimatedHours: 6 }],
      weights: [{ label: 'Exams', percent: 30 }],
      policies: { absencesAllowed: 4, dropRule: 'Lowest quiz dropped' },
      dropped: 0,
    });
  });

  it('sends the syllabus text to the model', async () => {
    const model = fake(GOOD);
    await request(appWith(model)).post('/ai/syllabus').send({ text: 'Week 9: Final project' });
    expect((model.complete as jest.Mock).mock.calls[0][0]).toContain('Week 9: Final project');
  });

  it.each([
    ['no body', undefined],
    ['no text', {}],
    ['text that is not a string', { text: 42 }],
    ['blank text', { text: '   ' }],
  ])('answers 400 for %s, without calling the model', async (_name, body) => {
    const model = fake(GOOD);
    const res = await request(appWith(model)).post('/ai/syllabus').send(body as object);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/syllabus text/);
    expect(model.complete).not.toHaveBeenCalled();
  });

  it('answers 413 for text over the limit, without calling the model', async () => {
    const model = fake(GOOD);
    const res = await request(appWith(model)).post('/ai/syllabus').send({ text: 'x'.repeat(MAX_SYLLABUS_CHARS + 1) });

    expect(res.status).toBe(413);
    expect(model.complete).not.toHaveBeenCalled();
  });

  it('answers 503 with a JSON error when the server has no model', async () => {
    const res = await request(appWith(null)).post('/ai/syllabus').send({ text: 'Week 1: Quiz' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not set up/);
  });

  it('answers 502 when the model fails, with the model error\'s own message', async () => {
    const res = await request(appWith(fake(new ModelError('The AI service could not be reached. Try again in a moment.'))))
      .post('/ai/syllabus')
      .send({ text: 'Week 1: Quiz' });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('The AI service could not be reached. Try again in a moment.');
  });

  it('answers 502 when the model\'s answer cannot be used', async () => {
    const res = await request(appWith(fake('Sorry, I cannot help with that.'))).post('/ai/syllabus').send({ text: 'Week 1: Quiz' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not be read/);
  });
});

describe('the AI routes inside the app', () => {
  it('need a session, like every route outside /api/auth', async () => {
    const { app } = await import('../app');
    const res = await request(app).get('/ai/status');
    expect(res.status).toBe(401);
  });

  it('answer a signed-in student', async () => {
    const api = await signedIn();
    const res = await api.get('/ai/status');

    expect(res.status).toBe(200);
    expect(typeof res.body.available).toBe('boolean');
  });
});
