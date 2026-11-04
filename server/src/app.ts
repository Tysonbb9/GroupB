import express from 'express';
import { createStore } from './data/create-store';
import { syllabusRouter } from './syllabus/routes';
import { DatabaseError } from './data/database-error';

export const app = express();
const store = createStore();

/**
 * CORS. A browser (the Expo Web version of the client) refuses to let a page
 * read a response from a different address unless the server allows it. A
 * phone does not check. "*" is fine for a prototype with no login or cookies.
 * The browser also sends an OPTIONS "preflight" before a PATCH, or before a
 * POST of a PDF, so answer that.
 */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json()); // Lets PATCH read a JSON body

// POST /syllabus/text: a syllabus PDF in, its text out. See syllabus/routes.ts.
app.use('/syllabus', syllabusRouter);
/**
 * GET /semester
 * Returns the whole semester: label, current week, weekly capacity,
 * courses and tasks.
 */

app.get('/semester', async (_req, res) => {
  const semester = await store.getSemester();
  res.json(semester);
});

app.get('/courses', async (_req, res) => {
  const courses = await store.listCourses();
  res.json(courses);
});

/**
 * GET /courses/:id
 * Returns one course, or 404 if the id is unknown.
 */
app.get('/courses/:id', async (req, res) => {
  const course = await store.getCourse(req.params.id);
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
app.get('/tasks/:id', async (req, res) => {
const task = await store.getTask(req.params.id);
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
app.get('/tasks', async (req, res) => {
  const { courseId, week, done } = req.query;
  let weekNumber: number | undefined;
  let doneValue: boolean | undefined;

  // Query values always arrive as strings ("7", not 7), so convert and check.
  if (week !== undefined) {
   const parsedWeek = Number(week); // "7" becomes 7, "abc" becomes NaN
    if (!Number.isInteger(parsedWeek)) {
      res.status(400).json({ error: 'week must be a whole number' });
      return;
    }
    weekNumber = parsedWeek;
  }

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      res.status(400).json({ error: 'done must be true or false' });
      return;
    }
    doneValue = done === 'true';
  }
  const tasks = await store.listTasks({
  courseId: typeof courseId === 'string' ? courseId : undefined,
  week: weekNumber,
  done: doneValue,
});

res.json(tasks);

});

/**
 * PATCH /tasks/:id
 * Body: { done?: boolean, estimatedHours?: number (more than 0, up to 100) | null }.
 * Returns the updated task, 400 if a field is invalid, 404 if the id is unknown.
 */
app.patch('/tasks/:id', async (req, res) => {
  const task = await store.getTask(req.params.id);
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
  // Same limits as the client's MAX_ESTIMATE_HOURS and the database's CHECK,
  // so a value the API accepts can always be saved.
  if (
    estimatedHours !== undefined &&
    estimatedHours !== null &&
    (typeof estimatedHours !== 'number' || !(estimatedHours > 0) || estimatedHours > 100)
  ) {
    res.status(400).json({ error: 'estimatedHours must be a number more than 0 and up to 100, or null' });
    return;
  }


const updatedTask = await store.updateTask(req.params.id, {
  done,
  estimatedHours,
});

res.json(updatedTask);
});

/**
 * POST /courses/:id/reviews
 * Body: { title: string, hours: number (more than 0, up to 100), comment?: string }.
 * Saves how long an assignment took. 201 with the new review, 400 if a field
 * is invalid, 404 if the course is unknown.
 */
app.post('/courses/:id/reviews', async (req, res) => {
  const course = await store.getCourse(req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  const { title, hours, comment } = req.body ?? {};

  // Check every field before saving anything (same idea as PATCH /tasks).
  if (typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'title must name the assignment' });
    return;
  }
  if (typeof hours !== 'number' || !(hours > 0) || hours > 100) {
    res.status(400).json({ error: 'hours must be a number more than 0 and up to 100' });
    return;
  }
  if (comment !== undefined && typeof comment !== 'string') {
    res.status(400).json({ error: 'comment must be text' });
    return;
  }
  const review = await store.addReview({
  courseId: course.id,
  title: title.trim(),
  hours,
  comment: comment?.trim() ?? '',
});

res.status(201).json(review); // 201 = "Created"
});

/**
 * GET /courses/:id/reviews
 * Returns every review of one course, or 404 if the course is unknown.
 */

app.get('/courses/:id/reviews', async (req, res) => {
  const course = await store.getCourse(req.params.id);

  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  const reviews = await store.listReviews(course.id);
  res.json(reviews);
});



app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err as { status?: number; type?: string };

  if (error.status === 413 || error.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request entity too large',
    });
    return;
  }

  console.error('API request failed:', err);

  if (err instanceof DatabaseError) {
    res.status(503).json({
      error: 'Database unavailable',
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
  });
});
