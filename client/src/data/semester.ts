import { Semester } from '../lib/types';

/**
 * Hardcoded stand-in for a real student's semester.
 *
 * Nothing here comes from a server — this whole file is what the syllabus
 * intake and calendar subscription will produce in a later phase. Keeping
 * it in one place means the screens never have to change when real data
 * arrives; only this file goes away.
 *
 * The numbers are meant to be plausible for a five-course load, including
 * the ordinary weekly reading and problem sets that make a semester heavy.
 */
export const semester: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 15,

  courses: [
    { id: 'cs262', code: 'CS 262', name: 'Software Engineering', attendance: { allowed: 4, used: 1 } },
    { id: 'cs336', code: 'CS 336', name: 'Web Development', attendance: { allowed: 3, used: 0 } },
    { id: 'math251', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
    { id: 'phil153', code: 'PHIL 153', name: 'Ethics', attendance: { allowed: 2, used: 2 } },
    { id: 'stat243', code: 'STAT 243', name: 'Statistics', attendance: { allowed: 3, used: 1 } },
  ],

  tasks: [
    // ---- CS 262 ----
    { id: '262-1', courseId: 'cs262', title: 'Team contract', dueWeek: 2, estimatedHours: 1, done: true },
    { id: '262-2', courseId: 'cs262', title: 'Vision statement', dueWeek: 3, estimatedHours: 2, done: false },
    { id: '262-3', courseId: 'cs262', title: 'Prototype demo', dueWeek: 4, estimatedHours: 6, spreadWeeks: 2, done: false },
    { id: '262-4', courseId: 'cs262', title: 'Sprint 1 review', dueWeek: 6, estimatedHours: 5, done: false },
    { id: '262-5', courseId: 'cs262', title: 'Sprint 2 demo', dueWeek: 9, estimatedHours: 7, spreadWeeks: 2, done: false },
    { id: '262-6', courseId: 'cs262', title: 'Sprint 3 demo', dueWeek: 12, estimatedHours: 9, spreadWeeks: 2, done: false },
    { id: '262-7', courseId: 'cs262', title: 'Final presentation', dueWeek: 15, estimatedHours: 8, spreadWeeks: 2, done: false },

    // ---- CS 336 ----
    { id: '336-1', courseId: 'cs336', title: 'Lab 1: DevTools', dueWeek: 2, estimatedHours: 2, done: true },
    { id: '336-2', courseId: 'cs336', title: 'Lab 2: Layout', dueWeek: 4, estimatedHours: 3, done: false },
    { id: '336-3', courseId: 'cs336', title: 'Lab 3: Forms', dueWeek: 6, estimatedHours: 3, done: false },
    { id: '336-4', courseId: 'cs336', title: 'Portfolio checkpoint', dueWeek: 7, estimatedHours: 7, spreadWeeks: 2, done: false },
    { id: '336-5', courseId: 'cs336', title: 'Lab 5: Accessibility', dueWeek: 10, estimatedHours: 3, done: false },
    { id: '336-6', courseId: 'cs336', title: 'Lab 6: State', dueWeek: 12, estimatedHours: 3, done: false },
    { id: '336-7', courseId: 'cs336', title: 'Final project', dueWeek: 15, estimatedHours: 18, spreadWeeks: 3, done: false },

    // ---- MATH 251 ----
    { id: 'm-0', courseId: 'math251', title: 'Syllabus quiz', dueWeek: 2, estimatedHours: 1, done: false },
    { id: 'm-1', courseId: 'math251', title: 'Problem set 1', dueWeek: 3, estimatedHours: 3, done: false },
    { id: 'm-2', courseId: 'math251', title: 'Problem set 2', dueWeek: 5, estimatedHours: 3, done: false },
    { id: 'm-3', courseId: 'math251', title: 'Midterm 1', dueWeek: 6, estimatedHours: 12, spreadWeeks: 2, done: false },
    { id: 'm-4', courseId: 'math251', title: 'Problem set 3', dueWeek: 7, estimatedHours: 3, done: false },
    { id: 'm-5', courseId: 'math251', title: 'Problem set 4', dueWeek: 9, estimatedHours: 3, done: false },
    { id: 'm-6', courseId: 'math251', title: 'Problem set 5', dueWeek: 11, estimatedHours: 3, done: false },
    { id: 'm-7', courseId: 'math251', title: 'Midterm 2', dueWeek: 12, estimatedHours: 12, spreadWeeks: 2, done: false },
    { id: 'm-8', courseId: 'math251', title: 'Final exam', dueWeek: 15, estimatedHours: 16, spreadWeeks: 2, done: false },

    // ---- PHIL 153 ----
    { id: 'p-1', courseId: 'phil153', title: 'Reading response 1', dueWeek: 3, estimatedHours: 2, done: false },
    { id: 'p-2', courseId: 'phil153', title: 'Reading response 2', dueWeek: 5, estimatedHours: 2, done: false },
    { id: 'p-3', courseId: 'phil153', title: 'Essay 1', dueWeek: 7, estimatedHours: 9, spreadWeeks: 2, done: false },
    { id: 'p-4', courseId: 'phil153', title: 'Reading response 3', dueWeek: 10, estimatedHours: 2, done: false },
    { id: 'p-5', courseId: 'phil153', title: 'Essay 2', dueWeek: 13, estimatedHours: 11, spreadWeeks: 2, done: false },
    { id: 'p-6', courseId: 'phil153', title: 'Reading response 4', dueWeek: 14, estimatedHours: 2, done: false },

    // ---- STAT 243 ----
    { id: 's-1', courseId: 'stat243', title: 'Homework 1', dueWeek: 3, estimatedHours: 2, done: false },
    { id: 's-2', courseId: 'stat243', title: 'Homework 2', dueWeek: 5, estimatedHours: 2, done: false },
    { id: 's-3', courseId: 'stat243', title: 'Midterm', dueWeek: 7, estimatedHours: 9, spreadWeeks: 2, done: false },
    { id: 's-4', courseId: 'stat243', title: 'Homework 4', dueWeek: 9, estimatedHours: 2, done: false },
    { id: 's-5', courseId: 'stat243', title: 'Data project', dueWeek: 13, estimatedHours: 12, spreadWeeks: 3, done: false },
    { id: 's-6', courseId: 'stat243', title: 'Final exam', dueWeek: 15, estimatedHours: 10, spreadWeeks: 2, done: false },
  ],
};
