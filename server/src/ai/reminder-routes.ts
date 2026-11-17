import express from 'express';
import type { Store } from '../data/store';
import type { ModelClient } from './model';
import { nextReminder, ReminderLog } from './reminders';

/**
 * The reminder (#156, AI screen 3). Mounted at /reminders, behind login.
 *
 * POST /reminders -> { reminder: { taskId, courseId, code, title, text, countToday, maxPerDay } | null }
 *   Asks for a reminder now. It is a POST because a reminder that is handed
 *   out is recorded, and the limits (at most 2 a day, never twice about one
 *   assignment) count it. null when no model is set up, when the limits say
 *   no, or when nothing is due this week or next. Like the check-in card,
 *   it is optional, so this never fails.
 *
 * The store, the model, the log and the clock are parameters, so tests can
 * use a fake model and a fixed clock.
 */
export function reminderRouter(
  store: Store,
  model: ModelClient | null,
  log: ReminderLog = new ReminderLog(),
  now: () => Date = () => new Date()
) {
  const router = express.Router();

  router.post('/', async (_req, res) => {
    // With no key set, no reminder appears and the app works as it did.
    if (model === null) {
      res.json({ reminder: null });
      return;
    }

    const userId: string = res.locals.session.user.id;
    const semester = await store.getSemester(userId);
    res.json({ reminder: nextReminder(userId, semester, log, now()) });
  });

  return router;
}
