import {
  MAX_REMINDERS_PER_DAY,
  nextReminder,
  pickReminder,
  ReminderLog,
  reminderText,
  remindersOn,
  type ShownReminder,
} from '../ai/reminders';
import type { Semester, Task } from '../types';

/**
 * #156, AI screen 3: the limits around a reminder are code, tested here with
 * a fixed clock. At most 2 a day, and never twice about the same assignment.
 *
 * The semester is in week 3. "quiz" is due this week (3h), "demo" next week
 * (6h), "lab" next week (3h). The rest never qualify: "late" is past due,
 * "far" is due in week 9, "done" is finished and "post" has no hours.
 */

const task = (id: string, dueWeek: number, estimatedHours: number | null, done = false): Task => ({
  id,
  courseId: id === 'demo' ? 'cs262' : 'math251',
  title: id[0].toUpperCase() + id.slice(1),
  dueWeek,
  estimatedHours,
  done,
});

const semester: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 15,
  courses: [
    { id: 'cs262', code: 'CS 262', name: 'Software Engineering', attendance: null },
    { id: 'math251', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
  ],
  tasks: [
    task('far', 9, 8),
    task('demo', 4, 6),
    task('lab', 4, 3),
    task('quiz', 3, 3),
    task('late', 2, 4),
    task('done', 3, 5, true),
    task('post', 3, null),
  ],
};

const morning = new Date('2026-11-16T09:00:00Z');
const evening = new Date('2026-11-16T20:00:00Z');
const tomorrow = new Date('2026-11-17T09:00:00Z');
const shownAt = (taskId: string, at: Date): ShownReminder => ({ taskId, shownAt: at });

describe('pickReminder', () => {
  it('picks the open assignment due soonest, this week before next', () => {
    expect(pickReminder(semester, [], morning)?.id).toBe('quiz');
  });

  it('then the one with the most hours, when two are due the same week', () => {
    const shown = [shownAt('quiz', new Date('2026-11-10T09:00:00Z'))];
    expect(pickReminder(semester, shown, morning)?.id).toBe('demo');
  });

  it('never reminds twice about the same assignment, even on another day', () => {
    const shown = [shownAt('quiz', new Date('2026-11-01T09:00:00Z')), shownAt('demo', new Date('2026-11-02T09:00:00Z'))];
    expect(pickReminder(semester, shown, morning)?.id).toBe('lab');
  });

  it(`stops at ${MAX_REMINDERS_PER_DAY} a day`, () => {
    const shown = [shownAt('quiz', morning), shownAt('demo', morning)];
    expect(pickReminder(semester, shown, evening)).toBeNull();
  });

  it('allows a second one on the same day', () => {
    expect(pickReminder(semester, [shownAt('quiz', morning)], evening)?.id).toBe('demo');
  });

  it('starts counting again the next day', () => {
    const shown = [shownAt('quiz', morning), shownAt('demo', evening)];
    expect(pickReminder(semester, shown, tomorrow)?.id).toBe('lab');
  });

  it('is null when everything that qualifies was already reminded about', () => {
    const old = new Date('2026-11-01T09:00:00Z');
    const shown = ['quiz', 'demo', 'lab'].map((id) => shownAt(id, old));
    expect(pickReminder(semester, shown, morning)).toBeNull();
  });

  it.each([
    ['past due', 'late'],
    ['due later than next week', 'far'],
    ['already done', 'done'],
    ['without hours', 'post'],
  ])('never picks an assignment that is %s', (_why, id) => {
    const only = { ...semester, tasks: semester.tasks.filter((t) => t.id === id) };
    expect(pickReminder(only, [], morning)).toBeNull();
  });

  it('does not depend on the order the tasks are stored in', () => {
    const reversed = { ...semester, tasks: [...semester.tasks].reverse() };
    expect(pickReminder(reversed, [], morning)?.id).toBe('quiz');
  });

  it('breaks a full tie by id', () => {
    const tied = { ...semester, tasks: [task('b', 4, 3), task('a', 4, 3)] };
    expect(pickReminder(tied, [], morning)?.id).toBe('a');
  });

  it('is null with no tasks at all', () => {
    expect(pickReminder({ ...semester, tasks: [] }, [], morning)).toBeNull();
  });
});

describe('remindersOn', () => {
  it('counts only the reminders shown on the same day', () => {
    const shown = [shownAt('a', morning), shownAt('b', evening), shownAt('c', tomorrow)];
    expect(remindersOn(shown, morning)).toBe(2);
    expect(remindersOn(shown, tomorrow)).toBe(1);
  });

  it('uses the UTC day, so a test clock gives the same answer anywhere', () => {
    const lateNight = new Date('2026-11-16T23:59:59Z');
    const justAfter = new Date('2026-11-17T00:00:00Z');
    expect(remindersOn([shownAt('a', lateNight)], justAfter)).toBe(0);
  });
});

describe('reminderText', () => {
  it('asks to start work due next week, with its hours and week', () => {
    expect(reminderText(task('demo', 4, 6), 3)).toBe('Start it this week: 6 hours, due week 4.');
  });

  it('asks to finish work due this week', () => {
    expect(reminderText(task('quiz', 3, 3), 3)).toBe('Finish it this week: 3 hours, due week 3.');
  });

  it('says "1 hour", and keeps a half hour', () => {
    expect(reminderText(task('x', 4, 1), 3)).toBe('Start it this week: 1 hour, due week 4.');
    expect(reminderText(task('x', 4, 2.5), 3)).toBe('Start it this week: 2.5 hours, due week 4.');
  });
});

describe('nextReminder and the log', () => {
  it('returns what the phone shows, with the count for today', () => {
    const log = new ReminderLog();
    expect(nextReminder('sam', semester, log, morning)).toEqual({
      taskId: 'quiz',
      courseId: 'math251',
      code: 'MATH 251',
      title: 'Quiz',
      text: 'Finish it this week: 3 hours, due week 3.',
      countToday: 1,
      maxPerDay: 2,
    });
  });

  it('records each reminder it hands out, so the next one is different', () => {
    const log = new ReminderLog();
    nextReminder('sam', semester, log, morning);
    const second = nextReminder('sam', semester, log, evening);
    expect(second).toMatchObject({ taskId: 'demo', countToday: 2 });
    expect(log.list('sam').map((s) => s.taskId)).toEqual(['quiz', 'demo']);
  });

  it('gives nothing, and records nothing, past the daily limit', () => {
    const log = new ReminderLog();
    nextReminder('sam', semester, log, morning);
    nextReminder('sam', semester, log, morning);
    expect(nextReminder('sam', semester, log, evening)).toBeNull();
    expect(log.list('sam')).toHaveLength(2);
  });

  it("keeps each student's record apart", () => {
    const log = new ReminderLog();
    nextReminder('sam', semester, log, morning);
    nextReminder('sam', semester, log, morning);
    expect(nextReminder('alex', semester, log, morning)).toMatchObject({ taskId: 'quiz', countToday: 1 });
  });

  it('hands out a copy of the record, so changing it changes nothing', () => {
    const log = new ReminderLog();
    nextReminder('sam', semester, log, morning);
    log.list('sam').pop();
    expect(log.list('sam')).toHaveLength(1);
  });
});
