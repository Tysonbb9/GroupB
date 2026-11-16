import { buildSnapshot, checkModelAnswer, RECENTLY_CONFIRMED_DAYS } from '../ai/checkin';
import type { Semester } from '../types';

/**
 * #155: the parts of the check-in question that are plain code. No server,
 * no model: just the snapshot code builds, and the check on the model's answer.
 */

const semester: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 15,
  courses: [
    { id: 'cs262', code: 'CS 262', name: 'Software Engineering', attendance: null },
    { id: 'math251', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
    { id: 'phil153', code: 'PHIL 153', name: 'Ethics', attendance: null },
  ],
  tasks: [
    { id: 'demo', courseId: 'cs262', title: 'Prototype demo', dueWeek: 4, estimatedHours: 6, done: false },
    { id: 'old', courseId: 'cs262', title: 'Team contract', dueWeek: 2, estimatedHours: 1, done: false },
    { id: 'ps', courseId: 'math251', title: 'Problem set 3', dueWeek: 5, estimatedHours: 3, done: false },
    { id: 'essay', courseId: 'phil153', title: 'Essay 1', dueWeek: 6, estimatedHours: 5, done: true },
  ],
};

const now = new Date('2026-11-15T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('buildSnapshot', () => {
  it('lists each course with its open tasks from this week on, and the current week', () => {
    const snapshot = buildSnapshot(semester, [], now);

    expect(snapshot.currentWeek).toBe(3);
    expect(snapshot.courses[0]).toEqual({
      courseId: 'cs262',
      code: 'CS 262',
      name: 'Software Engineering',
      openTasks: [{ title: 'Prototype demo', dueWeek: 4 }], // not the overdue Team contract
      lastConfirmed: null,
    });
  });

  it('leaves out a course with nothing open', () => {
    const ids = buildSnapshot(semester, [], now).courses.map((c) => c.courseId);
    expect(ids).toEqual(['cs262', 'math251']); // PHIL 153's only task is done
  });

  it('leaves out a course answered in the last week, and keeps one answered longer ago', () => {
    const snapshot = buildSnapshot(
      semester,
      [
        { courseId: 'cs262', answer: 'on-schedule', answeredAt: daysAgo(2) },
        { courseId: 'math251', answer: 'on-schedule', answeredAt: daysAgo(RECENTLY_CONFIRMED_DAYS + 1) },
      ],
      now
    );

    expect(snapshot.courses.map((c) => c.courseId)).toEqual(['math251']);
    expect(snapshot.courses[0].lastConfirmed).toBe(daysAgo(RECENTLY_CONFIRMED_DAYS + 1));
  });
});

describe('checkModelAnswer', () => {
  const snapshot = buildSnapshot(semester, [], now);

  it('accepts a course from the snapshot with a short reason', () => {
    expect(checkModelAnswer({ courseId: 'cs262', reason: '  The team board moved the demo.  ' }, snapshot)).toEqual({
      courseId: 'cs262',
      reason: 'The team board moved the demo.',
    });
  });

  it.each([
    ['not an object', 'cs262'],
    ['null', null],
    ['no courseId', { reason: 'Why not' }],
    ['a course that is not the student’s', { courseId: 'hack101', reason: 'Why not' }],
    ['a course with nothing to ask about', { courseId: 'phil153', reason: 'Why not' }],
  ])('asks nothing when the answer is %s', (_label, answer) => {
    expect(checkModelAnswer(answer, snapshot)).toBeNull();
  });

  it.each([
    ['has a number in it', 'The demo moved to week 5.'],
    ['is too long', 'x'.repeat(201)],
    ['is blank', '   '],
    ['is not text', 42],
  ])('keeps the course but drops a reason that %s', (_label, reason) => {
    expect(checkModelAnswer({ courseId: 'cs262', reason }, snapshot)).toEqual({ courseId: 'cs262', reason: null });
  });
});
