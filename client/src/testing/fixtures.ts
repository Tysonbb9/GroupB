import { Semester } from '../lib/types';

/**
 * A semester with one wall, small enough to reason about exactly.
 * Capacity is 10 hours a week and the current week is 3.
 *
 *   week 5:  10h  Big project (half of its 20 hours)
 *   week 6:  18h  Big project (10h) + Midterm (8h)   <- next wall
 *   week 7:  14h  Paper                              <- still over capacity
 *
 * "Discussion post" has no estimate, so it puts nothing in the forecast.
 */
export const wallSemester: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 10,
  courses: [
    { id: 'c1', code: 'CS 262', name: 'Software Engineering', attendance: null },
    { id: 'c2', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
  ],
  tasks: [
    { id: 'proj', courseId: 'c1', title: 'Big project', dueWeek: 6, estimatedHours: 20, spreadWeeks: 2, done: false },
    { id: 'exam', courseId: 'c2', title: 'Midterm', dueWeek: 6, estimatedHours: 8, done: false },
    { id: 'paper', courseId: 'c1', title: 'Paper', dueWeek: 7, estimatedHours: 14, done: false },
    { id: 'post', courseId: 'c1', title: 'Discussion post', dueWeek: 3, estimatedHours: null, done: false },
    { id: 'gone', courseId: 'c2', title: 'Old quiz', dueWeek: 5, estimatedHours: 30, done: true },
  ],
};
