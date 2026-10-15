import {
  applyCrowdEstimates,
  CrowdReport,
  crowdEstimate,
  MIN_CROWD_REPORTS,
  processInputs,
  scanSyllabus,
} from './inputs';
import { MAX_ESTIMATE_HOURS } from './estimate';
import { Semester, Task } from './types';
import { weeklyLoad } from './workload';
import { wallSemester } from '../testing/fixtures';

// --- helpers ---------------------------------------------------------------

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    courseId: 'c1',
    title: 'Quiz',
    dueWeek: 5,
    estimatedHours: null,
    done: false,
    ...overrides,
  };
}

function report(hours: number, title = 'Quiz', courseId = 'c1'): CrowdReport {
  return { courseId, title, hours };
}

/** Freezes an object and everything inside it, so any mutation throws. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A small seeded random generator, so a failure can be reproduced exactly. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(random: () => number, items: T[]): T =>
  items[Math.floor(random() * items.length)];

// --- scanSyllabus: reading a line ------------------------------------------

describe('scanSyllabus', () => {
  it('reads the week, title and hours off a line', () => {
    const { tasks, skipped } = scanSyllabus('Week 7: Midterm 1 (8 hours)', 'c2');
    expect(tasks).toEqual([
      { courseId: 'c2', title: 'Midterm 1', dueWeek: 7, estimatedHours: 8, done: false },
    ]);
    expect(skipped).toEqual([]);
  });

  it('keeps an assignment with no hours, with no estimate', () => {
    const { tasks } = scanSyllabus('Week 3: Discussion post', 'c1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].estimatedHours).toBeNull();
    expect(tasks[0].title).toBe('Discussion post');
  });

  it.each([
    ['Week 2: Essay (4 hours)', 4],
    ['Week 2: Essay (1 hour)', 1],
    ['Week 2: Essay (2.5 hrs)', 2.5],
    ['Week 2: Essay (3 hr)', 3],
    ['Week 2: Essay (3h)', 3],
    ['Week 2: Essay ( 6 hours )', 6],
    ['WEEK 2: Essay (4 HOURS)', 4],
  ])('understands the hours in %j', (line, hours) => {
    const { tasks } = scanSyllabus(line, 'c1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].estimatedHours).toBe(hours);
    expect(tasks[0].title).toBe('Essay');
  });

  it.each([
    ['Week 4: Quiz'],
    ['Week 4 - Quiz'],
    ['Week 4 – Quiz'],
    ['Week 4 — Quiz'],
    ['Week 4 Quiz'],
    ['Week 4:Quiz'],
    ['week 4: Quiz'],
    ['   Week 4: Quiz   '],
  ])('reads the separator in %j', (line) => {
    const { tasks } = scanSyllabus(line, 'c1');
    expect(tasks.map((t) => [t.dueWeek, t.title])).toEqual([[4, 'Quiz']]);
  });

  it.each([['- Week 3: Lab'], ['* Week 3: Lab'], ['• Week 3: Lab']])(
    'accepts a bullet before the line, as in %j',
    (line) => {
      expect(scanSyllabus(line, 'c1').tasks.map((t) => t.title)).toEqual(['Lab']);
    }
  );

  it('reads several lines in order, whatever the line endings', () => {
    const text = 'Week 1: A\r\nWeek 2: B\rWeek 3: C\nWeek 4: D';
    expect(scanSyllabus(text, 'c1').tasks.map((t) => t.title)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('ignores blank lines without calling them skipped', () => {
    const { tasks, skipped } = scanSyllabus('\n\nWeek 1: A\n   \n\t\nWeek 2: B\n\n', 'c1');
    expect(tasks).toHaveLength(2);
    expect(skipped).toEqual([]);
  });

  it('returns nothing for an empty syllabus', () => {
    expect(scanSyllabus('', 'c1')).toEqual({ tasks: [], skipped: [] });
    expect(scanSyllabus('   \n  ', 'c1')).toEqual({ tasks: [], skipped: [] });
  });

  it('marks every scanned assignment as not done, in the given course, with no category', () => {
    const { tasks } = scanSyllabus('Week 1: A\nWeek 2: B (3 hours)', 'math');
    for (const t of tasks) {
      expect(t.done).toBe(false);
      expect(t.courseId).toBe('math');
      expect(t.category).toBeUndefined();
      expect(t).not.toHaveProperty('id');
    }
  });

  it('keeps the title as written apart from trimming', () => {
    const { tasks } = scanSyllabus('Week 5: Problem Set 3: Eigenvalues & Eigenvectors', 'c1');
    expect(tasks[0].title).toBe('Problem Set 3: Eigenvalues & Eigenvectors');
  });
});

describe('scanSyllabus: week boundaries', () => {
  it.each([1, 8, 15])('accepts week %i', (week) => {
    expect(scanSyllabus(`Week ${week}: Quiz`, 'c1').tasks).toHaveLength(1);
  });

  it.each([0, 16, 99, 100, 1000, 12345])('skips week %i, which is outside the semester', (week) => {
    const { tasks, skipped } = scanSyllabus(`Week ${week}: Quiz`, 'c1');
    expect(tasks).toEqual([]);
    expect(skipped).toEqual([`Week ${week}: Quiz`]);
  });

  it('accepts a leading zero', () => {
    expect(scanSyllabus('Week 05: Quiz', 'c1').tasks[0].dueWeek).toBe(5);
  });

  it.each([['Week 5-7: Project'], ['Week 5–7: Project'], ['Week 5—7: Project']])(
    'skips a week range instead of guessing: %j',
    (line) => {
      const { tasks, skipped } = scanSyllabus(line, 'c1');
      expect(tasks).toEqual([]);
      expect(skipped).toEqual([line]);
    }
  );

  it('does not mistake a dash before a number for a range', () => {
    const { tasks } = scanSyllabus('Week 5 - 2 page paper', 'c1');
    expect(tasks.map((t) => [t.dueWeek, t.title])).toEqual([[5, '2 page paper']]);
  });

  it.each([['Week: Quiz'], ['Week one: Quiz'], ['Wk 3: Quiz'], ['Weekly quiz'], ['Weeks 3: Quiz']])(
    'skips a line that does not name a week number: %j',
    (line) => {
      expect(scanSyllabus(line, 'c1').tasks).toEqual([]);
    }
  );
});

describe('scanSyllabus: hours', () => {
  it('accepts the largest estimate and nothing above it', () => {
    expect(scanSyllabus(`Week 1: A (${MAX_ESTIMATE_HOURS} hours)`, 'c1').tasks[0].estimatedHours).toBe(
      MAX_ESTIMATE_HOURS
    );
    const over = scanSyllabus(`Week 1: A (${MAX_ESTIMATE_HOURS + 0.5} hours)`, 'c1').tasks[0];
    expect(over.estimatedHours).toBeNull();
  });

  it.each([['0 hours'], ['0.0 hours'], ['101 hours'], ['500 hours']])(
    'keeps the assignment, with no estimate, when the hours are unusable: %j',
    (hours) => {
      const { tasks } = scanSyllabus(`Week 2: Essay (${hours})`, 'c1');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].estimatedHours).toBeNull();
      // Left visible in the title rather than silently dropped.
      expect(tasks[0].title).toBe(`Essay (${hours})`);
    }
  );

  it('only takes hours from the end of the line', () => {
    const { tasks } = scanSyllabus('Week 2: Read (3 hours) chapter 4', 'c1');
    expect(tasks[0].estimatedHours).toBeNull();
    expect(tasks[0].title).toBe('Read (3 hours) chapter 4');
  });

  it('only takes the last bracket when there are two', () => {
    const { tasks } = scanSyllabus('Week 2: Essay (draft) (5 hours)', 'c1');
    expect(tasks[0].title).toBe('Essay (draft)');
    expect(tasks[0].estimatedHours).toBe(5);
  });

  it.each([['(hours)'], ['(h)'], ['(4 days)'], ['(4)'], ['4 hours'], ['(-4 hours)']])(
    'does not read %j as hours',
    (text) => {
      const { tasks } = scanSyllabus(`Week 2: Essay ${text}`, 'c1');
      expect(tasks[0].estimatedHours).toBeNull();
    }
  );

  it('skips a line that has a week but nothing after it', () => {
    expect(scanSyllabus('Week 5:', 'c1').tasks).toEqual([]);
    expect(scanSyllabus('Week 5', 'c1').tasks).toEqual([]);
    expect(scanSyllabus('Week 5: (4 hours)', 'c1').tasks).toEqual([]);
  });
});

describe('scanSyllabus: lines it cannot read', () => {
  it('reports them, trimmed and in order, rather than dropping them', () => {
    const text = ['CS 262 Syllabus', 'Week 1: Intro', '  Office hours: Tue 2pm  ', 'Week 9: Quiz'].join('\n');
    const { tasks, skipped } = scanSyllabus(text, 'c1');
    expect(tasks.map((t) => t.title)).toEqual(['Intro', 'Quiz']);
    expect(skipped).toEqual(['CS 262 Syllabus', 'Office hours: Tue 2pm']);
  });

  it('accounts for every non-blank line exactly once', () => {
    const text = 'a\nWeek 1: A\n\nb\nWeek 99: C\nWeek 2: D';
    const { tasks, skipped } = scanSyllabus(text, 'c1');
    expect(tasks.length + skipped.length).toBe(5);
  });
});

// --- crowdEstimate ----------------------------------------------------------

describe('crowdEstimate', () => {
  it('has the threshold the rest of this file assumes', () => {
    expect(MIN_CROWD_REPORTS).toBe(3);
  });

  it.each([[[]], [[4]], [[4, 5]]])('gives no estimate from fewer than three reports: %j', (hours) => {
    expect(crowdEstimate(hours)).toBeNull();
  });

  it('gives the median once there are three', () => {
    expect(crowdEstimate([2, 4, 3])).toBe(3);
  });

  it('gives the middle one of an odd number of reports', () => {
    expect(crowdEstimate([9, 1, 5, 3, 7])).toBe(5);
  });

  it('averages the two middle reports of an even number', () => {
    expect(crowdEstimate([1, 2, 3, 4])).toBe(2.5);
    expect(crowdEstimate([2, 8, 4, 6])).toBe(5);
  });

  it('is not pulled around by one wild report', () => {
    expect(crowdEstimate([2, 3, 4, 100])).toBe(3.5);
    expect(crowdEstimate([3, 3, 3, 100])).toBe(3);
  });

  it('gives the same answer for every ordering', () => {
    expect(crowdEstimate([5, 1, 3])).toBe(crowdEstimate([1, 3, 5]));
    expect(crowdEstimate([3, 5, 1])).toBe(crowdEstimate([1, 3, 5]));
  });

  it('gives the shared value when everyone agrees', () => {
    expect(crowdEstimate([6, 6, 6, 6])).toBe(6);
  });

  it.each([[0], [-3], [NaN], [Infinity], [-Infinity], [MAX_ESTIMATE_HOURS + 0.1], [1000]])(
    'does not count %p as a report',
    (bad) => {
      // Two good reports plus a bad one is still only two.
      expect(crowdEstimate([2, 4, bad])).toBeNull();
      // And a bad one never changes what the good ones say.
      expect(crowdEstimate([2, 4, 6, bad])).toBe(4);
    }
  );

  it('counts the largest allowed report but nothing above it', () => {
    expect(crowdEstimate([MAX_ESTIMATE_HOURS, MAX_ESTIMATE_HOURS, MAX_ESTIMATE_HOURS])).toBe(MAX_ESTIMATE_HOURS);
    expect(crowdEstimate([MAX_ESTIMATE_HOURS, MAX_ESTIMATE_HOURS, MAX_ESTIMATE_HOURS + 1])).toBeNull();
  });

  it('accepts small fractional reports', () => {
    expect(crowdEstimate([0.25, 0.5, 0.75])).toBe(0.5);
  });

  it('does not change the array it is given', () => {
    const hours = Object.freeze([5, 1, 3]) as unknown as number[];
    expect(crowdEstimate(hours)).toBe(3);
    expect(hours).toEqual([5, 1, 3]);
  });
});

// --- applyCrowdEstimates ----------------------------------------------------

describe('applyCrowdEstimates', () => {
  const threeReports = [report(2), report(3), report(4)];

  it('fills an unestimated task when enough students reported', () => {
    const [result] = applyCrowdEstimates([task()], threeReports);
    expect(result.estimatedHours).toBe(3);
  });

  it('matches the title whatever the capitalisation or spacing', () => {
    const reports = [report(2, 'MIDTERM  one'), report(3, ' midterm one '), report(4, 'Midterm One')];
    const [result] = applyCrowdEstimates([task({ title: 'Midterm one' })], reports);
    expect(result.estimatedHours).toBe(3);
  });

  it('keeps courses apart, even for the same title', () => {
    const [result] = applyCrowdEstimates([task({ courseId: 'c2' })], threeReports);
    expect(result.estimatedHours).toBeNull();
  });

  it('keeps different titles apart', () => {
    const [result] = applyCrowdEstimates([task({ title: 'Final' })], threeReports);
    expect(result.estimatedHours).toBeNull();
  });

  it('leaves a task alone when fewer than three students reported', () => {
    const original = task();
    const [result] = applyCrowdEstimates([original], [report(2), report(3)]);
    expect(result).toBe(original);
    expect(result.estimatedHours).toBeNull();
  });

  it('does not count unusable reports towards the three', () => {
    const [result] = applyCrowdEstimates([task()], [report(2), report(3), report(0), report(-1), report(NaN)]);
    expect(result.estimatedHours).toBeNull();
  });

  it("never replaces the student's own estimate", () => {
    const [result] = applyCrowdEstimates([task({ estimatedHours: 10 })], threeReports);
    expect(result.estimatedHours).toBe(10);
  });

  it("treats the student's own estimate of zero as theirs too", () => {
    const [result] = applyCrowdEstimates([task({ estimatedHours: 0 })], threeReports);
    expect(result.estimatedHours).toBe(0);
  });

  it('returns new tasks and leaves the originals untouched', () => {
    const original = deepFreeze(task());
    const [result] = applyCrowdEstimates([original], threeReports);
    expect(result).not.toBe(original);
    expect(original.estimatedHours).toBeNull();
  });

  it('keeps every other field of the task', () => {
    const original = task({ id: 'x', category: 'exam', spreadWeeks: 2, dueWeek: 9, done: true });
    const [result] = applyCrowdEstimates([original], threeReports);
    expect(result).toEqual({ ...original, estimatedHours: 3 });
  });

  it('handles each task on its own', () => {
    const tasks = [
      task({ id: 'a', title: 'Quiz' }),
      task({ id: 'b', title: 'Essay', estimatedHours: 5 }),
      task({ id: 'c', title: 'Lab' }),
    ];
    const result = applyCrowdEstimates(tasks, threeReports);
    expect(result.map((t) => t.estimatedHours)).toEqual([3, 5, null]);
  });

  it('returns the tasks unchanged when there are no reports', () => {
    const tasks = [task(), task({ id: 't2', estimatedHours: 4 })];
    expect(applyCrowdEstimates(tasks, [])).toEqual(tasks);
  });

  it('returns an empty list for an empty list', () => {
    expect(applyCrowdEstimates([], threeReports)).toEqual([]);
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'treats the title %j as an ordinary title',
    (title) => {
      const reports = [report(2, title), report(3, title), report(4, title)];
      const [filled] = applyCrowdEstimates([task({ title })], reports);
      expect(filled.estimatedHours).toBe(3);
      // And with no reports at all, it must not find something on the prototype.
      const [bare] = applyCrowdEstimates([task({ title })], []);
      expect(bare.estimatedHours).toBeNull();
    }
  );
});

// --- processInputs ----------------------------------------------------------

describe('processInputs', () => {
  const semester = wallSemester;

  it('with no inputs, changes nothing and just recomputes', () => {
    const result = processInputs(semester);
    expect(result.tasks).toEqual(semester.tasks);
    expect(result.skipped).toEqual([]);
    expect(result.unknownCourses).toEqual([]);
    expect(result.loads).toEqual(weeklyLoad(semester.tasks));
  });

  it('adds scanned assignments to the semester after the existing ones', () => {
    const result = processInputs(semester, {
      syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (12 hours)' }],
    });
    expect(result.tasks).toHaveLength(semester.tasks.length + 1);
    expect(result.tasks.slice(0, semester.tasks.length)).toEqual(semester.tasks);
    expect(result.tasks[result.tasks.length - 1]).toEqual({
      id: 'c2-syl-1',
      courseId: 'c2',
      title: 'Lab report',
      dueWeek: 4,
      estimatedHours: 12,
      done: false,
    });
  });

  it('numbers new ids per course, in the order scanned', () => {
    const result = processInputs(semester, {
      syllabi: [
        { courseId: 'c1', text: 'Week 1: A\nWeek 2: B' },
        { courseId: 'c2', text: 'Week 3: C' },
      ],
    });
    expect(result.tasks.slice(-3).map((t) => t.id)).toEqual(['c1-syl-1', 'c1-syl-2', 'c2-syl-1']);
  });

  it('never reuses an id the semester already has', () => {
    const withSyl: Semester = {
      ...semester,
      tasks: [...semester.tasks, task({ id: 'c1-syl-1', title: 'Old', dueWeek: 2 })],
    };
    const result = processInputs(withSyl, { syllabi: [{ courseId: 'c1', text: 'Week 1: New' }] });
    const ids = result.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('c1-syl-2');
  });

  it('reports lines it could not read, with their course', () => {
    const result = processInputs(semester, {
      syllabi: [{ courseId: 'c1', text: 'Grading policy\nWeek 1: A' }],
    });
    expect(result.skipped).toEqual([{ courseId: 'c1', line: 'Grading policy', reason: 'unrecognised' }]);
  });

  describe('duplicates', () => {
    it('skips an assignment the semester already has, whatever the capitalisation', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 6: MIDTERM (8 hours)' }] });
      expect(result.tasks).toHaveLength(semester.tasks.length);
      expect(result.skipped).toEqual([{ courseId: 'c2', line: 'Week 6: MIDTERM', reason: 'duplicate' }]);
    });

    it('skips a repeat within the same syllabus, keeping the first', () => {
      const result = processInputs(semester, {
        syllabi: [{ courseId: 'c1', text: 'Week 2: Quiz (1 hour)\nWeek 2: quiz (9 hours)' }],
      });
      const added = result.tasks.slice(semester.tasks.length);
      expect(added.map((t) => t.estimatedHours)).toEqual([1]);
      expect(result.skipped.map((s) => s.reason)).toEqual(['duplicate']);
    });

    it('skips a repeat across two syllabi for the same course', () => {
      const result = processInputs(semester, {
        syllabi: [
          { courseId: 'c1', text: 'Week 2: Quiz' },
          { courseId: 'c1', text: 'Week 2: Quiz' },
        ],
      });
      expect(result.tasks).toHaveLength(semester.tasks.length + 1);
    });

    it('keeps the same title in a different week', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 9: Midterm (8 hours)' }] });
      expect(result.tasks).toHaveLength(semester.tasks.length + 1);
    });

    it('keeps the same title and week in a different course', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c1', text: 'Week 6: Midterm (8 hours)' }] });
      expect(result.tasks).toHaveLength(semester.tasks.length + 1);
    });

    it('does not confuse "Quiz1" in week 2 with "Quiz" in week 12', () => {
      const withQuiz: Semester = { ...semester, tasks: [task({ id: 'q', title: 'Quiz1', dueWeek: 2 })] };
      const result = processInputs(withQuiz, { syllabi: [{ courseId: 'c1', text: 'Week 12: Quiz' }] });
      expect(result.tasks).toHaveLength(2);
    });

    it('treats an assignment the student already finished as already there', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 5: Old quiz (30 hours)' }] });
      expect(result.tasks).toHaveLength(semester.tasks.length);
      expect(result.tasks.find((t) => t.id === 'gone')?.done).toBe(true);
    });
  });

  describe('courses the semester does not have', () => {
    it('adds nothing for them and says so once', () => {
      const result = processInputs(semester, {
        syllabi: [
          { courseId: 'nope', text: 'Week 1: A\nWeek 2: B' },
          { courseId: 'nope', text: 'Week 3: C' },
        ],
      });
      expect(result.tasks).toEqual(semester.tasks);
      expect(result.unknownCourses).toEqual(['nope']);
      expect(result.skipped).toEqual([]);
    });

    it('still processes the known courses alongside them', () => {
      const result = processInputs(semester, {
        syllabi: [
          { courseId: 'nope', text: 'Week 1: A' },
          { courseId: 'c1', text: 'Week 1: B' },
        ],
      });
      expect(result.tasks).toHaveLength(semester.tasks.length + 1);
      expect(result.unknownCourses).toEqual(['nope']);
    });
  });

  describe('calculations', () => {
    it('always gives one load per week of the semester', () => {
      expect(processInputs(semester).loads.map((l) => l.week)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1)
      );
    });

    it('puts scanned hours into the forecast', () => {
      const before = weeklyLoad(semester.tasks)[3].hours;
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (12 hours)' }] });
      expect(before).toBe(0);
      expect(result.loads[3]).toEqual({ week: 4, hours: 12 });
    });

    it('finds a new crunch window the scanned work creates', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (12 hours)' }] });
      expect(result.crunch).toEqual([
        { startWeek: 4, endWeek: 4, peakHours: 12 },
        { startWeek: 6, endWeek: 7, peakHours: 18 },
      ]);
    });

    it('joins a new heavy week to the crunch next to it', () => {
      // Week 5 sits at exactly 10 hours (capacity), so 1 more tips it over
      // and joins weeks 5-7 into one window.
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 5: Reading (1 hour)' }] });
      expect(result.crunch).toEqual([{ startWeek: 5, endWeek: 7, peakHours: 18 }]);
    });

    it('does not call a week exactly at capacity a crunch', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (10 hours)' }] });
      expect(result.crunch).toEqual([{ startWeek: 6, endWeek: 7, peakHours: 18 }]);
    });

    it('uses the semester capacity', () => {
      const roomy: Semester = { ...semester, weeklyCapacity: 40 };
      const result = processInputs(roomy, { syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (12 hours)' }] });
      expect(result.crunch).toEqual([]);
    });

    it('leaves an unestimated scanned assignment out of the forecast', () => {
      const result = processInputs(semester, { syllabi: [{ courseId: 'c2', text: 'Week 4: Reflection' }] });
      expect(result.loads).toEqual(weeklyLoad(semester.tasks));
    });
  });

  describe('crowd-sourced input', () => {
    const syllabi = [{ courseId: 'c2', text: 'Week 9: Quiz' }];

    it('estimates a scanned assignment when enough students reported', () => {
      const result = processInputs(semester, {
        syllabi,
        crowdReports: [report(1, 'Quiz', 'c2'), report(2, 'Quiz', 'c2'), report(6, 'Quiz', 'c2')],
      });
      expect(result.tasks[result.tasks.length - 1].estimatedHours).toBe(2);
      expect(result.loads[8]).toEqual({ week: 9, hours: 2 });
    });

    it('leaves it unestimated when too few reported', () => {
      const result = processInputs(semester, {
        syllabi,
        crowdReports: [report(1, 'Quiz', 'c2'), report(2, 'Quiz', 'c2')],
      });
      expect(result.tasks[result.tasks.length - 1].estimatedHours).toBeNull();
      expect(result.loads[8].hours).toBe(0);
    });

    it('prefers the hours written on the syllabus to the crowd', () => {
      const result = processInputs(semester, {
        syllabi: [{ courseId: 'c2', text: 'Week 9: Quiz (5 hours)' }],
        crowdReports: [report(1, 'Quiz', 'c2'), report(2, 'Quiz', 'c2'), report(3, 'Quiz', 'c2')],
      });
      expect(result.tasks[result.tasks.length - 1].estimatedHours).toBe(5);
    });

    it('also estimates tasks the semester already had', () => {
      const result = processInputs(semester, {
        crowdReports: [report(3, 'Discussion post'), report(4, 'Discussion post'), report(5, 'Discussion post')],
      });
      expect(result.tasks.find((t) => t.id === 'post')?.estimatedHours).toBe(4);
      expect(result.loads[2]).toEqual({ week: 3, hours: 4 });
    });

    it('can push a week over capacity', () => {
      const result = processInputs(semester, {
        crowdReports: [report(12, 'Discussion post'), report(12, 'Discussion post'), report(12, 'Discussion post')],
      });
      expect(result.crunch[0]).toEqual({ startWeek: 3, endWeek: 3, peakHours: 12 });
    });
  });

  describe('purity', () => {
    const inputs = {
      syllabi: [{ courseId: 'c2', text: 'Week 4: Lab report (12 hours)\nnotes\nWeek 9: Quiz' }],
      crowdReports: [report(1, 'Quiz', 'c2'), report(2, 'Quiz', 'c2'), report(3, 'Quiz', 'c2')],
    };

    it('does not change the semester or the inputs it is given', () => {
      const frozenSemester = deepFreeze(structuredClone(semester));
      const frozenInputs = deepFreeze(structuredClone(inputs));
      expect(() => processInputs(frozenSemester, frozenInputs)).not.toThrow();
      expect(frozenSemester).toEqual(semester);
      expect(frozenInputs).toEqual(inputs);
    });

    it('gives the same answer every time', () => {
      expect(processInputs(semester, inputs)).toEqual(processInputs(semester, inputs));
    });

    it('adds nothing new when its own result is processed again', () => {
      const first = processInputs(semester, inputs);
      const again = processInputs({ ...semester, tasks: first.tasks }, inputs);
      expect(again.tasks).toEqual(first.tasks);
      expect(again.loads).toEqual(first.loads);
      expect(again.crunch).toEqual(first.crunch);
      expect(again.skipped.filter((s) => s.reason === 'duplicate')).toHaveLength(2);
    });

    it('gives the same forecast whichever order the syllabi arrive in', () => {
      const a = { courseId: 'c1', text: 'Week 2: A (3 hours)\nWeek 8: B (5 hours)' };
      const b = { courseId: 'c2', text: 'Week 2: C (4 hours)\nWeek 8: D (6 hours)' };
      const ab = processInputs(semester, { syllabi: [a, b] });
      const ba = processInputs(semester, { syllabi: [b, a] });
      expect(ab.loads).toEqual(ba.loads);
      expect(ab.crunch).toEqual(ba.crunch);
    });
  });

  it('copes with a very large syllabus', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `Week ${(i % 15) + 1}: Task ${i} (1 hour)`);
    const result = processInputs(semester, { syllabi: [{ courseId: 'c1', text: lines.join('\n') }] });
    expect(result.tasks).toHaveLength(semester.tasks.length + 2000);
    expect(new Set(result.tasks.map((t) => t.id)).size).toBe(result.tasks.length);
  });
});

// --- property-style tests with seeded random input --------------------------

describe('randomised checks (seeded, so any failure can be replayed)', () => {
  const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

  const TITLES = ['Quiz', 'Midterm', 'Lab report', 'Reading', 'Essay draft', 'Problem set 3', 'Final project'];
  const SEPARATORS = [': ', ' - ', ' – ', ' — ', ' ', ':'];
  const PREFIXES = ['', '- ', '* ', '• ', '  '];
  const UNITS = ['hours', 'hour', 'hrs', 'hr', 'h', 'HOURS'];
  const HOURS = [0.5, 1, 2, 2.5, 4, 8, 12, 100];

  function validLine(random: () => number) {
    const week = 1 + Math.floor(random() * 15);
    const title = pick(random, TITLES);
    const hours = random() < 0.7 ? pick(random, HOURS) : null;
    const text =
      pick(random, PREFIXES) +
      'Week ' + week + pick(random, SEPARATORS) + title +
      (hours === null ? '' : ` (${hours} ${pick(random, UNITS)})`);
    return { week, title, hours, text };
  }

  it.each(SEEDS)('reads back exactly what well-formed lines say (seed %i)', (seed) => {
    const random = seeded(seed);
    const lines = Array.from({ length: 20 }, () => validLine(random));
    const { tasks, skipped } = scanSyllabus(lines.map((l) => l.text).join('\n'), 'c1');

    expect(skipped).toEqual([]);
    expect(tasks.map((t) => [t.dueWeek, t.title, t.estimatedHours])).toEqual(
      lines.map((l) => [l.week, l.title, l.hours])
    );
  });

  const TOKENS = [
    'week ', 'Week ', 'WEEK ', '1', '15', '16', '0', '7', '5-7', ' - ', '–', ':', '(', ')',
    '(4 hours)', '(500 hours)', '(0h)', '\n', '\r\n', '\r', '  ', '\t', 'Quiz', '*', '•', 'é', '漢字',
    '', '.', '3h', '\u0000', '\u200B', '😀',
  ];

  it.each(SEEDS)('never throws on rubbish, and accounts for every line (seed %i)', (seed) => {
    const random = seeded(seed * 7919);
    for (let round = 0; round < 40; round++) {
      const count = 1 + Math.floor(random() * 14);
      const text = Array.from({ length: count }, () => pick(random, TOKENS)).join('');

      const { tasks, skipped } = scanSyllabus(text, 'c1');

      const nonBlank = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length;
      expect(tasks.length + skipped.length).toBe(nonBlank);
      for (const t of tasks) {
        expect(Number.isInteger(t.dueWeek)).toBe(true);
        expect(t.dueWeek).toBeGreaterThanOrEqual(1);
        expect(t.dueWeek).toBeLessThanOrEqual(15);
        expect(t.title).toBe(t.title.trim());
        expect(t.title).not.toBe('');
        expect(t.done).toBe(false);
        if (t.estimatedHours !== null) {
          expect(t.estimatedHours).toBeGreaterThan(0);
          expect(t.estimatedHours).toBeLessThanOrEqual(MAX_ESTIMATE_HOURS);
        }
      }
    }
  });

  it.each(SEEDS)('keeps the crowd estimate between the smallest and largest usable report (seed %i)', (seed) => {
    const random = seeded(seed * 104729);
    const hours = Array.from({ length: 3 + Math.floor(random() * 10) }, () => Math.round(random() * 400) / 4);
    const usable = hours.filter((h) => h > 0 && h <= MAX_ESTIMATE_HOURS);
    const estimate = crowdEstimate(hours);

    if (usable.length < MIN_CROWD_REPORTS) {
      expect(estimate).toBeNull();
    } else {
      expect(estimate).toBeGreaterThanOrEqual(Math.min(...usable));
      expect(estimate).toBeLessThanOrEqual(Math.max(...usable));
    }
  });

  it.each(SEEDS)('gives the same crowd estimate for any ordering and any extra junk (seed %i)', (seed) => {
    const random = seeded(seed * 1299709);
    const good = Array.from({ length: 3 + Math.floor(random() * 8) }, () => 1 + Math.floor(random() * 40));
    const shuffled = [...good].sort(() => random() - 0.5);
    const withJunk = [...shuffled, 0, -5, NaN, Infinity, 500];
    expect(crowdEstimate(shuffled)).toBe(crowdEstimate(good));
    expect(crowdEstimate(withJunk)).toBe(crowdEstimate(good));
  });

  it.each(SEEDS)('keeps every scanned hour in the forecast, and never invents any (seed %i)', (seed) => {
    const random = seeded(seed * 15485863);
    const lines = Array.from({ length: 12 }, () => validLine(random));
    const text = lines.map((l) => l.text).join('\n');
    const result = processInputs(wallSemester, { syllabi: [{ courseId: 'c1', text }] });

    // Hours are spread, never lost: the bars add up to the outstanding work
    // that has an estimate and falls inside the semester.
    const expected = result.tasks
      .filter((t) => !t.done && t.estimatedHours !== null && t.dueWeek >= 1 && t.dueWeek <= 15)
      .reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const shown = result.loads.reduce((sum, l) => sum + l.hours, 0);
    expect(shown).toBeCloseTo(expected, 6);

    // Unique ids, 15 weeks, and the original tasks first and unchanged.
    expect(new Set(result.tasks.map((t) => t.id)).size).toBe(result.tasks.length);
    expect(result.loads).toHaveLength(15);
    expect(result.tasks.slice(0, wallSemester.tasks.length)).toEqual(wallSemester.tasks);
    // Every line is either added or skipped as a repeat.
    expect(result.tasks.length - wallSemester.tasks.length + result.skipped.length).toBe(lines.length);
  });

  it.each(SEEDS)('is idempotent for any syllabus (seed %i)', (seed) => {
    const random = seeded(seed * 32452843);
    const lines = Array.from({ length: 10 }, () => validLine(random));
    const inputs = { syllabi: [{ courseId: 'c2', text: lines.map((l) => l.text).join('\n') }] };

    const once = processInputs(wallSemester, inputs);
    const twice = processInputs({ ...wallSemester, tasks: once.tasks }, inputs);
    expect(twice.tasks).toEqual(once.tasks);
  });
});

// --- hostile and oversized input -------------------------------------------

describe('hostile and oversized input', () => {
  it('reads a very long line without hanging', () => {
    const line = 'Week 3: ' + 'a'.repeat(200_000);
    const { tasks } = scanSyllabus(line, 'c1');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title.length).toBe(200_000);
  });

  it('does not stall on brackets and spaces built to confuse the hours pattern', () => {
    const nasty = ['Week 1: x ' + '('.repeat(50_000), 'Week 1: x (' + ' '.repeat(100_000), 'Week 1: x (1' + ' '.repeat(100_000) + 'hours'].join('\n');
    const started = Date.now();
    const { tasks, skipped } = scanSyllabus(nasty, 'c1');
    expect(tasks.length + skipped.length).toBe(3);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not stall on a huge run of whitespace after the week', () => {
    const started = Date.now();
    scanSyllabus('Week 1' + ' '.repeat(200_000) + 'x', 'c1');
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('treats markup and script in a title as plain text', () => {
    const { tasks } = scanSyllabus('Week 2: <script>alert(1)</script> (3 hours)', 'c1');
    expect(tasks[0].title).toBe('<script>alert(1)</script>');
    expect(tasks[0].estimatedHours).toBe(3);
  });

  it('handles non-English titles and emoji', () => {
    const { tasks } = scanSyllabus('Week 2: 期末レポート 📚 (6 hours)', 'c1');
    expect(tasks[0].title).toBe('期末レポート 📚');
  });

  it.each(['__proto__', 'constructor', 'toString'])('copes with %j as a course id', (courseId) => {
    const result = processInputs(wallSemester, { syllabi: [{ courseId, text: 'Week 1: A' }] });
    expect(result.unknownCourses).toEqual([courseId]);
    expect(result.tasks).toEqual(wallSemester.tasks);
  });
});
