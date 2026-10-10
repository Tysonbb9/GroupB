import express from 'express';
import { db } from './data/db';

export const app = express();
app.use(express.json()); // Lets PATCH read a JSON body
/**
 * GET /semester
 * Returns the whole semester: label, current week, weekly capacity,
 * courses and tasks.
 */
app.get('/semester', (_req, res) => {
    res.json(db);
  });
app.get('/courses', (_req, res) => {
  res.json(db.courses);
});

/**
 * GET /courses/:id
 * Returns one course, or 404 if the id is unknown.
 */
app.get('/courses/:id', (req, res) => {
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return; // stop here, or Express tries to send a second response
  }
  res.json(course);
});

/**
 * GET /tasks/:id
 * Returns one task, or 404 if the id is unknown.
 */
app.get('/tasks/:id', (req, res) => {
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(task);
});

/**
 * GET /tasks
 * Returns all tasks, narrowed by any filters given:
 * ?courseId=cs262, ?week=7 (due week), ?done=true|false.
 * Returns 400 if week or done isn't a valid value.
 */
app.get('/tasks', (req, res) => {
  const { courseId, week, done } = req.query;
  let result = db.tasks;

  if (courseId !== undefined) {
    result = result.filter((t) => t.courseId === courseId);
  }

  // Query values always arrive as strings ("7", not 7), so convert and check.
  if (week !== undefined) {
    const weekNumber = Number(week); // "7" becomes 7, "abc" becomes NaN
    if (!Number.isInteger(weekNumber)) {
      res.status(400).json({ error: 'week must be a whole number' });
      return;
    }
    result = result.filter((t) => t.dueWeek === weekNumber);
  }

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      res.status(400).json({ error: 'done must be true or false' });
      return;
    }
    result = result.filter((t) => t.done === (done === 'true'));
  }

  res.json(result);
});

/**
 * PATCH /tasks/:id
 * Body: { done?: boolean, estimatedHours?: number | null }.
 * Returns the updated task, 400 if a field is invalid, 404 if the id is unknown.
 */
app.patch('/tasks/:id', (req, res) => {
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { done, estimatedHours } = req.body ?? {};

  // Check every field before changing anything, so a bad request
  // never leaves a task half-updated.
  if (done !== undefined && typeof done !== 'boolean') {
    res.status(400).json({ error: 'done must be true or false' });
    return;
  }
  if (
    estimatedHours !== undefined &&
    estimatedHours !== null &&
    (typeof estimatedHours !== 'number' || estimatedHours < 0)
  ) {
    res.status(400).json({ error: 'estimatedHours must be a number 0 or more, or null' });
    return;
  }

  if (done !== undefined) task.done = done;
  if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
  res.json(task);
});
