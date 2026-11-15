import express from 'express';
import { ModelClient, ModelError } from './model';
import { MAX_SYLLABUS_CHARS, ReadingError, readSyllabus } from './syllabus-reading';

/**
 * The AI routes (issue #145). Both need a signed-in student, because app.ts
 * mounts this router after the session check.
 *
 * GET /ai/status
 *   { available: true } when the server has a model, false when it has none.
 *   The phone asks first, so with no key the app keeps today's scanner.
 *
 * POST /ai/syllabus
 *   Body: { text } the syllabus text (pasted, or read from a PDF by
 *   POST /syllabus/text). Answers with the checked reading:
 *   { assignments, weights, policies, dropped }. Every field has passed the
 *   checks in syllabus-reading.ts.
 *     400 no text, or it is not a string
 *     413 more than MAX_SYLLABUS_CHARS characters
 *     502 the model failed or its answer could not be used
 *     503 the server has no model
 *
 * The model is a parameter so tests hand in a fake one.
 */
export function aiRouter(model: ModelClient | null): express.Router {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    res.json({ available: model !== null });
  });

  router.post('/syllabus', async (req, res) => {
    const text: unknown = req.body?.text;
    if (typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({ error: 'Send the syllabus text as { "text": "..." }.' });
      return;
    }
    if (text.length > MAX_SYLLABUS_CHARS) {
      res.status(413).json({
        error: 'That syllabus is too long to read in one go. Paste the part with the schedule.',
      });
      return;
    }
    if (model === null) {
      res.status(503).json({ error: 'Reading with AI is not set up on this server.' });
      return;
    }

    try {
      res.json(await readSyllabus(model, text));
    } catch (error) {
      // Problems with the model or its answer are expected, and their messages
      // are written for a student. Anything else is our own bug: pass it on.
      if (error instanceof ModelError || error instanceof ReadingError) {
        res.status(502).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  return router;
}
