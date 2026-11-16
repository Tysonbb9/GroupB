import express from 'express';
import type { Store } from '../data/store';
import type { CheckinAnswer } from '../types';
import { isValidHours } from '../rules';
import type { ModelClient } from './model';
import { buildSnapshot, checkModelAnswer, CHECKIN_INSTRUCTIONS } from './checkin';

const ANSWERS: CheckinAnswer[] = ['on-schedule', 'changed', 'none-of-these'];

/**
 * The check-in question (#155). Mounted at /checkin, behind login.
 *
 * GET  /checkin  -> { question: { courseId, code, text, reason } | null }
 *   null when no model is set, nothing needs asking, or the model's answer
 *   did not pass the checks. The card is optional, so this never fails.
 *
 * POST /checkin  { courseId, answer, changes? } -> { checkin, tasks }
 *   Saves the student's answer (and, for "changed", the new weeks and hours)
 *   only when they tap. All or nothing.
 *
 * The store and the model are parameters, so tests hand in a fake model.
 */
export function checkinRouter(store: Store, model: ModelClient | null) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    if (model === null) {
      res.json({ question: null });
      return;
    }

    const userId: string = res.locals.session.user.id;
    const semester = await store.getSemester();
    const checkins = await Promise.all(semester.courses.map((c) => store.getCheckin(userId, c.id)));
    const snapshot = buildSnapshot(semester, checkins, new Date());
    if (snapshot.courses.length === 0) {
      res.json({ question: null });
      return;
    }

    let pick;
    try {
      // The model answers with text. JSON.parse throws if it isn't JSON,
      // and that lands in the catch like any other model problem.
      const text = await model.complete(`${CHECKIN_INSTRUCTIONS}\n\n${JSON.stringify(snapshot)}`);
      pick = checkModelAnswer(JSON.parse(text), snapshot);
    } catch (err) {
      console.error('Check-in question skipped:', err instanceof Error ? err.message : err);
      pick = null;
    }
    if (!pick) {
      res.json({ question: null });
      return;
    }

    const course = semester.courses.find((c) => c.id === pick.courseId)!;
    res.json({
      question: {
        courseId: course.id,
        code: course.code,
        text: `Is ${course.code} still on schedule?`,
        reason: pick.reason,
      },
    });
  });

  router.post('/', async (req, res) => {
    const { courseId, answer, changes } = req.body ?? {};

    if (!ANSWERS.includes(answer)) {
      res.status(400).json({ error: 'answer must be on-schedule, changed or none-of-these' });
      return;
    }

    const course = typeof courseId === 'string' ? await store.getCourse(courseId) : null;
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (answer !== 'changed' && changes !== undefined) {
      res.status(400).json({ error: 'changes only go with the answer changed' });
      return;
    }

    const updates: { taskId: string; dueWeek: number; estimatedHours: number | null }[] = [];
    if (answer === 'changed') {
      if (!Array.isArray(changes) || changes.length === 0) {
        res.status(400).json({ error: 'changes must list at least one task' });
        return;
      }
      // Check every change before saving any (same idea as POST /tasks).
      for (const [i, c] of changes.entries()) {
        const n = i + 1;
        const task = typeof c?.taskId === 'string' ? await store.getTask(c.taskId) : null;
        if (!task || task.courseId !== course.id || task.done) {
          res.status(400).json({ error: `Change ${n}: taskId must be an open task of ${course.code}` });
          return;
        }
        if (!Number.isInteger(c.dueWeek) || c.dueWeek < 1 || c.dueWeek > 15) {
          res.status(400).json({ error: `Change ${n}: dueWeek must be a whole number from 1 to 15` });
          return;
        }
        if (c.estimatedHours !== null && !isValidHours(c.estimatedHours)) {
          res.status(400).json({ error: `Change ${n}: estimatedHours must be more than 0 and up to 100, or null` });
          return;
        }
        updates.push({ taskId: task.id, dueWeek: c.dueWeek, estimatedHours: c.estimatedHours });
      }
    }

    const tasks = [];
    for (const u of updates) {
      tasks.push(await store.updateTask(u.taskId, { dueWeek: u.dueWeek, estimatedHours: u.estimatedHours }));
    }
    const userId: string = res.locals.session.user.id;
    const checkin = await store.saveCheckin(userId, course.id, answer);

    res.json({ checkin, tasks });
  });

  return router;
}
