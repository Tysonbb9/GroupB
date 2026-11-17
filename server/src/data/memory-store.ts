import { normalizeCourseCode, courseIdBase, type NewCourse } from './course-catalog';
import { db, details, inputs } from './db';
import { semester as sample, DEFAULT_WEEKLY_CAPACITY } from './semester';
import { DatabaseError } from './database-error';
import type { Store, TaskFilters, TaskUpdates, NewReview, NewTask, SemesterUpdates } from './store';
import { nextTaskId } from './task-ids';
import type { CalendarImport, CheckinAnswer, Review, Task } from '../types';

/**
 * Refuses a course that does not exist, as the database's foreign keys do,
 * so code that only ran against this store still behaves with Supabase.
 */
function requireCourse(courseId: string, action: string): void {
  if (!db.courses.some((course) => course.id === courseId)) {
    throw new DatabaseError(`Failed to ${action}: course ${courseId} does not exist`);
  }
}

export class MemoryStore implements Store {
async getSemester(userId: string) {
  return {
    label: db.label,
    currentWeek: db.currentWeek,
    weeklyCapacity: db.settings.get(userId) ?? DEFAULT_WEEKLY_CAPACITY,
    courses: await this.listCourses(userId),
    tasks: await this.listTasks(userId, {}),
  };
}

async updateSemester(userId: string, updates: SemesterUpdates) {
  if (updates.weeklyCapacity !== undefined) db.settings.set(userId, updates.weeklyCapacity);
  return this.getSemester(userId);
}

// Search suggests catalog choices; it never changes a student's enrollments.
async searchCatalog(userId: string, query: string) {
  const key = normalizeCourseCode(query.trim());
  const name = query.trim().toLowerCase();
  const rank = (code: string) => key && code === key ? 0 : key && code.startsWith(key) ? 1 : 2;
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return db.courses
    .map(course => ({ course, key: normalizeCourseCode(course.code) }))
    .filter(row => (key && row.key.includes(key)) || row.course.name.toLowerCase().includes(name))
    .sort((a, b) => rank(a.key) - rank(b.key) || compare(a.key, b.key) || compare(a.course.id, b.course.id))
    .slice(0, 10)
    .map(({ course }) => ({ ...structuredClone(course), enrolled: db.enrollments.some(row => row.userId === userId && row.courseId === course.id) }));
}

async enroll(userId: string, courseId: string) {
  const course = db.courses.find(course => course.id === courseId);
  if (!course) return null;
  if (!db.enrollments.some(row => row.userId === userId && row.courseId === courseId)) db.enrollments.push({ userId, courseId });
  return structuredClone(course);
}

// Decide and insert before yielding, so simultaneous creates cannot both succeed.
async createCourse(userId: string, input: NewCourse) {
  const code = input.code.trim(), name = input.name.trim(), key = normalizeCourseCode(code);
  const existing = db.courses.find(course => normalizeCourseCode(course.code) === key);
  if (existing) return { created: false, course: structuredClone(existing) };
  const base = courseIdBase(code);
  let id = base, suffix = 2;
  while (db.courses.some(course => course.id === id)) id = `${base}-${suffix++}`;
  const course = { id, code, name, attendance: null };
  db.courses.push(course);
  db.enrollments.push({ userId, courseId: id });
  return { created: true, course: structuredClone(course) };
}

async listCourses(userId: string) {
  const enrolled = new Set(db.enrollments.filter(row => row.userId === userId).map(row => row.courseId));
  return structuredClone(db.courses.filter(course => enrolled.has(course.id)));
}

async getCourse(userId: string, id: string) {
  return (await this.listCourses(userId)).find(course => course.id === id) ?? null;
}

async getTask(userId: string, id: string) {
  return (await this.listTasks(userId, {})).find(task => task.id === id) ?? null;
}

async listTasks(userId: string, filters: TaskFilters) {
  return db.tasks
    .filter(task => task.userId === userId)
    .filter(task => filters.courseId === undefined || task.courseId === filters.courseId)
    .filter(task => filters.week === undefined || task.dueWeek === filters.week)
    .filter(task => filters.done === undefined || task.done === filters.done)
    .map(({ userId: _userId, ...task }) => structuredClone(task));
}

async updateTask(userId: string, id: string, updates: TaskUpdates) {
  const task = db.tasks.find(task => task.userId === userId && task.id === id);
  if (!task) return null;
  if (updates.done !== undefined) task.done = updates.done;
  if (updates.estimatedHours !== undefined) task.estimatedHours = updates.estimatedHours;
  if (updates.dueWeek !== undefined) task.dueWeek = updates.dueWeek;
  return this.getTask(userId, id);
}

async deleteTask(userId: string, id: string) {
  const before = db.tasks.length;
  db.tasks = db.tasks.filter(task => !(task.userId === userId && task.id === id));
  return db.tasks.length < before;
}

// The route checks enrollment and every task first, so the batch cannot partly apply.
async addTasks(userId: string, newTasks: NewTask[]) {
  const taken = new Set(db.tasks.filter(task => task.userId === userId).map(task => task.id));
  return newTasks.map(newTask => {
    const task: Task = { ...newTask, id: nextTaskId(newTask.courseId, taken), done: false };
    taken.add(task.id);
    db.tasks.push({ ...task, userId });
    return task;
  });
}

// Check and copy before the first await, so concurrent calls cannot add two samples.
async loadSample(userId: string) {
  if (db.enrollments.some(row => row.userId === userId) || db.tasks.some(task => task.userId === userId)) return null;
  db.enrollments.push(...sample.courses.map(course => ({ userId, courseId: course.id })));
  db.tasks.push(...structuredClone(sample.tasks).map(task => ({ ...task, userId })));
  if (!db.settings.has(userId)) db.settings.set(userId, DEFAULT_WEEKLY_CAPACITY);
  return this.getSemester(userId);
}

async addReview(review: NewReview) {
  const newReview: Review = {
    id: `review-${inputs.reviews.length + 1}`,
    courseId: review.courseId,
    title: review.title,
    hours: review.hours,
    comment: review.comment,
  };

  inputs.reviews.push(newReview);

  return newReview;
}

async listReviews(courseId: string) {
  return inputs.reviews.filter(
    (review) => review.courseId === courseId
  );
}

// Course details (#144). Each method hands back copies, like rows read from
// a database, so a caller changing them cannot change what is saved.

async getCheckin(userId: string, courseId: string) {
  const checkin = details.checkins[userId]?.[courseId];
  return checkin ? { ...checkin } : null;
}

async saveCheckin(userId: string, courseId: string, answer: CheckinAnswer) {
  requireCourse(courseId, 'save check-in');
  const checkin = { courseId, answer, answeredAt: new Date().toISOString() };
  details.checkins[userId] = { ...details.checkins[userId], [courseId]: checkin };
  return { ...checkin };
}

async listWeekHours(userId: string) {
  return Object.entries(details.weekHours[userId] ?? {})
    .map(([week, hours]) => ({ week: Number(week), hours }))
    .sort((a, b) => a.week - b.week);
}

async setWeekHours(userId: string, week: number, hours: number | null) {
  const weeks = { ...details.weekHours[userId] };
  if (hours === null) {
    delete weeks[week];
  } else {
    weeks[week] = hours;
  }
  details.weekHours[userId] = weeks;
  return this.listWeekHours(userId);
}

async getCalendarLink(userId: string) {
  const link = details.calendarLinks[userId];
  return link ? { ...link } : null;
}

async saveCalendarLink(userId: string, url: string) {
  const link = { url, savedAt: new Date().toISOString() };
  details.calendarLinks[userId] = link;
  return { ...link };
}

async listCalendarImports(userId: string) {
  return Object.values(details.calendarImports[userId] ?? {}).map((row) => ({ ...row }));
}

async recordCalendarImports(userId: string, imports: CalendarImport[]) {
  const rows = { ...details.calendarImports[userId] };
  for (const row of imports) rows[row.eventId] = { ...row };
  details.calendarImports[userId] = rows;
}

async deleteCalendarImports(userId: string, eventIds: string[]) {
  const rows = { ...details.calendarImports[userId] };
  for (const id of eventIds) delete rows[id];
  details.calendarImports[userId] = rows;
}

}
