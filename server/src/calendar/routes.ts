import express from 'express';
import type { Store } from '../data/store';
import { fetchCalendar } from './fetch-calendar';
import { isValidHours, WEEKS_IN_SEMESTER } from '../rules';
import { parseIcs } from './ics';
import { allowedCalendarHosts, checkCalendarLink } from './link';
import { buildProposals, semesterStart } from './proposals';

/**
 * A student's Moodle calendar link (US-48, #164). Mounted at /calendar, behind login.
 *
 * GET  /calendar/link            -> { saved: boolean, savedAt: string | null }
 * GET  /calendar/events          -> { proposals, alreadyAdded, outsideSemester }   (US-49, #165)
 * POST /calendar/events { tasks } -> 201 { tasks }                                  (US-49, #165)
 * POST /calendar/link { url }     -> 200 { saved: true, savedAt }
 *                                   400 the link is not an allowed https Moodle link
 *                                   422 Moodle answered, but not with a calendar
 *                                   502 Moodle could not be reached
 *
 * The link is checked, fetched once to make sure it gives a calendar, and
 * only then saved, replacing any earlier one. It holds a private token, so
 * no answer ever contains it, and nothing here logs it.
 *
 * GET /calendar/events reads the saved calendar and proposes its events as
 * tasks to review (see proposals.ts); nothing is saved. 409 when no link is
 * saved, and the same 400, 422 or 502 as above when the link no longer works,
 * in plain words. POST /calendar/events adds the tasks the student kept, all
 * or nothing, and records which event each came from, so it is not offered
 * again.
 *
 * fetchFn, hosts and the clock are parameters, so tests never fetch a real
 * address and can fix today's date.
 */
export function calendarRouter(
  store: Store,
  fetchFn: typeof fetch = fetch,
  hosts: () => string[] = () => allowedCalendarHosts(),
  now: () => Date = () => new Date()
) {
  const router = express.Router();

  router.get('/link', async (_req, res) => {
    const userId: string = res.locals.session.user.id;
    const link = await store.getCalendarLink(userId);
    res.json({ saved: link !== null, savedAt: link?.savedAt ?? null });
  });

  router.post('/link', async (req, res) => {
    const userId: string = res.locals.session.user.id;

    const checked = checkCalendarLink(req.body?.url, hosts());
    if (!checked.ok) {
      res.status(400).json({ error: checked.problem });
      return;
    }

    const fetched = await fetchCalendar(checked.url, fetchFn);
    if (!fetched.ok) {
      res.status(fetched.reason === 'unreachable' ? 502 : 422).json({ error: fetched.problem });
      return;
    }

    const link = await store.saveCalendarLink(userId, checked.url);
    res.json({ saved: true, savedAt: link.savedAt });
  });

  router.get('/events', async (_req, res) => {
    const userId: string = res.locals.session.user.id;
    const link = await store.getCalendarLink(userId);
    if (!link) {
      res.status(409).json({ error: 'Save your Moodle calendar link first.' });
      return;
    }

    // Checked again, in case the allowed hosts changed since it was saved.
    const checked = checkCalendarLink(link.url, hosts());
    if (!checked.ok) {
      res.status(400).json({ error: `${checked.problem} Save a new link.` });
      return;
    }
    const fetched = await fetchCalendar(checked.url, fetchFn);
    if (!fetched.ok) {
      res.status(fetched.reason === 'unreachable' ? 502 : 422).json({ error: fetched.problem });
      return;
    }

    const semester = await store.getSemester(userId);
    const imported = new Set((await store.listCalendarImports(userId)).map((row) => row.eventId));
    const start = semesterStart(semester.currentWeek, now());
    res.json(buildProposals(parseIcs(fetched.text), semester.courses, semester.tasks, imported, start));
  });

  router.post('/events', async (req, res) => {
    const userId: string = res.locals.session.user.id;
    const { tasks } = req.body ?? {};
    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({ error: 'tasks must be a list with at least one task' });
      return;
    }

    const courseIds = new Set((await store.listCourses(userId)).map((course) => course.id));
    const imported = new Set((await store.listCalendarImports(userId)).map((row) => row.eventId));
    const eventIds = new Set<string>();

    // Check every task before adding any, like POST /tasks.
    for (const [i, t] of tasks.entries()) {
      const n = i + 1;
      if (typeof t?.eventId !== 'string' || t.eventId.trim() === '') {
        res.status(400).json({ error: `Task ${n}: eventId must name the calendar event` });
        return;
      }
      if (eventIds.has(t.eventId) || imported.has(t.eventId)) {
        res.status(409).json({ error: `Task ${n}: that calendar event was already added` });
        return;
      }
      eventIds.add(t.eventId);
      if (!courseIds.has(t.courseId)) {
        res.status(400).json({ error: `Task ${n}: courseId must be one of your courses` });
        return;
      }
      if (typeof t.title !== 'string' || t.title.trim() === '') {
        res.status(400).json({ error: `Task ${n}: title must name the assignment` });
        return;
      }
      if (!Number.isInteger(t.dueWeek) || t.dueWeek < 1 || t.dueWeek > WEEKS_IN_SEMESTER) {
        res.status(400).json({ error: `Task ${n}: dueWeek must be a whole number from 1 to ${WEEKS_IN_SEMESTER}` });
        return;
      }
      const hours = t.estimatedHours ?? null;
      if (hours !== null && !isValidHours(hours)) {
        res.status(400).json({ error: `Task ${n}: estimatedHours must be more than 0 and up to 100, or null` });
        return;
      }
    }

    // Calendar events carry no hours, so a task has none unless the student typed some (US-13).
    const added = await store.addTasks(
      userId,
      tasks.map((t) => ({
        courseId: t.courseId,
        title: t.title.trim(),
        dueWeek: t.dueWeek,
        estimatedHours: t.estimatedHours ?? null,
      }))
    );
    await store.recordCalendarImports(
      userId,
      added.map((task, i) => ({ eventId: tasks[i].eventId, taskId: task.id, dueWeek: task.dueWeek }))
    );
    res.status(201).json({ tasks: added });
  });

  return router;
}
