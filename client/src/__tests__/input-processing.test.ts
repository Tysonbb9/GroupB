import { processInputs } from '../lib/inputs';
import { Semester } from '../lib/types';
import { assignmentsInWeek, nextWall, recommendStart, startBy } from '../lib/workload';
import { wallSemester } from '../testing/fixtures';

/**
 * US-24: as a student, I want my inputs processed (syllabus scanned,
 * calculations performed, crowd-sourcing input handled), so that I get
 * meaningful results.
 *
 * These read like the story: hand over a syllabus and some crowd reports,
 * then check what the student would get back. They run the real workload
 * functions over the result, with nothing mocked.
 */

const syllabus = [
  'MATH 251 - Linear Algebra',
  'Office hours: Tuesday 2pm',
  'Week 4: Lab report (12 hours)',
  'Week 7 - Proposal (5 hours)',
  'Week 9: Quiz',
].join('\n');

const quizReports = [1, 2, 6].map((hours) => ({ courseId: 'c2', title: 'Quiz', hours }));

const inputs = { syllabi: [{ courseId: 'c2', text: syllabus }], crowdReports: quizReports };

describe('US-24: syllabus scanned', () => {
  it('turns the syllabus into assignments in the right course and week', () => {
    const { tasks } = processInputs(wallSemester, inputs);
    const added = tasks.slice(wallSemester.tasks.length);

    expect(added.map((t) => [t.courseId, t.title, t.dueWeek])).toEqual([
      ['c2', 'Lab report', 4],
      ['c2', 'Proposal', 7],
      ['c2', 'Quiz', 9],
    ]);
  });

  it('takes the hours the syllabus gives', () => {
    const { tasks } = processInputs(wallSemester, inputs);
    expect(tasks.find((t) => t.title === 'Lab report')?.estimatedHours).toBe(12);
    expect(tasks.find((t) => t.title === 'Proposal')?.estimatedHours).toBe(5);
  });

  it('tells the student which lines it could not read, instead of losing them', () => {
    const { skipped } = processInputs(wallSemester, inputs);
    expect(skipped).toEqual([
      { courseId: 'c2', line: 'MATH 251 - Linear Algebra', reason: 'unrecognised' },
      { courseId: 'c2', line: 'Office hours: Tuesday 2pm', reason: 'unrecognised' },
    ]);
  });

  it('does not add the same assignments twice if the syllabus is processed again', () => {
    const first = processInputs(wallSemester, inputs);
    const again = processInputs({ ...wallSemester, tasks: first.tasks }, inputs);
    expect(again.tasks).toHaveLength(first.tasks.length);
  });

  it('adds nothing for a course the student is not taking', () => {
    const result = processInputs(wallSemester, { syllabi: [{ courseId: 'bio', text: syllabus }] });
    expect(result.tasks).toEqual(wallSemester.tasks);
    expect(result.unknownCourses).toEqual(['bio']);
  });
});

describe('US-24: calculations performed', () => {
  it('shows the scanned work in the weekly forecast', () => {
    const { loads } = processInputs(wallSemester, inputs);
    expect(loads.find((l) => l.week === 4)?.hours).toBe(12);
    // Week 7 had the 14-hour paper; the proposal adds 5.
    expect(loads.find((l) => l.week === 7)?.hours).toBe(19);
  });

  it('shows a new crunch the syllabus creates, and keeps the old one', () => {
    const before = processInputs(wallSemester).crunch;
    const after = processInputs(wallSemester, inputs).crunch;

    expect(before).toEqual([{ startWeek: 6, endWeek: 7, peakHours: 18 }]);
    expect(after).toEqual([
      { startWeek: 4, endWeek: 4, peakHours: 12 },
      { startWeek: 6, endWeek: 7, peakHours: 19 },
    ]);
  });

  it('does not count work the student has already finished', () => {
    const { loads } = processInputs(wallSemester, inputs);
    // "Old quiz" is done, 30 hours, due week 5. Week 5 is still only the project's half.
    expect(loads.find((l) => l.week === 5)?.hours).toBe(10);
  });

  it('feeds the existing planning functions, so the student gets advice, not just numbers', () => {
    const { tasks, loads } = processInputs(wallSemester, inputs);

    // Week 4 is now the first week over capacity from week 3.
    const wall = nextWall(loads, wallSemester.weeklyCapacity, wallSemester.currentWeek);
    expect(wall).toEqual({ week: 4, hours: 12 });

    // The lab report is what to start, and 12 hours at 10 a week needs 2 weeks.
    const lab = tasks.find((t) => t.title === 'Lab report')!;
    expect(startBy(lab, wallSemester.weeklyCapacity)).toBe(3);
    expect(recommendStart(tasks, 4, wallSemester.weeklyCapacity)).toEqual({ task: lab, startWeek: 3 });
    expect(assignmentsInWeek(tasks, 4).map((a) => a.task.title)).toEqual(['Lab report']);
  });
});

describe('US-24: crowd-sourcing input handled', () => {
  it('estimates an assignment from what other students reported, once enough did', () => {
    const { tasks, loads } = processInputs(wallSemester, inputs);
    expect(tasks.find((t) => t.title === 'Quiz')?.estimatedHours).toBe(2);
    expect(loads.find((l) => l.week === 9)?.hours).toBe(2);
  });

  it('does not estimate from too few reports', () => {
    const result = processInputs(wallSemester, { ...inputs, crowdReports: quizReports.slice(0, 2) });
    expect(result.tasks.find((t) => t.title === 'Quiz')?.estimatedHours).toBeNull();
    expect(result.loads.find((l) => l.week === 9)?.hours).toBe(0);
  });

  it('is not thrown by one exaggerated report', () => {
    const reports = [...quizReports, { courseId: 'c2', title: 'Quiz', hours: 99 }];
    const { tasks } = processInputs(wallSemester, { ...inputs, crowdReports: reports });
    // 1, 2, 6, 99: the middle two average to 4, not the 27 a plain average gives.
    expect(tasks.find((t) => t.title === 'Quiz')?.estimatedHours).toBe(4);
  });

  it("never overrides what the student wrote or entered themselves", () => {
    const withOwn: Semester = {
      ...wallSemester,
      tasks: wallSemester.tasks.map((t) => (t.id === 'post' ? { ...t, estimatedHours: 7 } : t)),
    };
    const reports = [1, 1, 1].map((hours) => ({ courseId: 'c1', title: 'Discussion post', hours }));
    const { tasks } = processInputs(withOwn, { crowdReports: reports });
    expect(tasks.find((t) => t.id === 'post')?.estimatedHours).toBe(7);
  });

  it('keeps reports for one course from changing another', () => {
    const elsewhere = quizReports.map((r) => ({ ...r, courseId: 'c1' }));
    const result = processInputs(wallSemester, { syllabi: inputs.syllabi, crowdReports: elsewhere });
    expect(result.tasks.find((t) => t.title === 'Quiz')?.estimatedHours).toBeNull();
  });
});

describe('US-24: the student gets a meaningful result', () => {
  it('leaves the semester they started with untouched', () => {
    const snapshot = JSON.stringify(wallSemester);
    processInputs(wallSemester, inputs);
    expect(JSON.stringify(wallSemester)).toBe(snapshot);
  });

  it('gives a complete, usable semester back', () => {
    const { tasks, loads } = processInputs(wallSemester, inputs);
    const processed: Semester = { ...wallSemester, tasks };

    expect(processed.tasks.every((t) => t.courseId === 'c1' || t.courseId === 'c2')).toBe(true);
    expect(new Set(processed.tasks.map((t) => t.id)).size).toBe(processed.tasks.length);
    expect(loads).toHaveLength(15);
  });
});
