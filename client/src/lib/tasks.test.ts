import {
  absencesRemaining,
  attendanceStatus,
  comingUp,
  groupThisWeek,
  rankThisWeek,
  startsNow,
} from './tasks';
import { Course, Semester, Task } from './types';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    courseId: 'c1',
    title: 'Something',
    dueWeek: 5,
    estimatedHours: 4,
    done: false,
    ...over,
  };
}

function semester(tasks: Task[], currentWeek = 5): Semester {
  return {
    label: 'Fall 2026',
    currentWeek,
    weeklyCapacity: 15,
    courses: [],
    tasks,
  };
}

function course(over: Partial<Course> = {}): Course {
  return {
    id: 'c1',
    code: 'CS 262',
    name: 'Software Engineering',
    attendance: { allowed: 4, used: 0 },
    ...over,
  };
}

describe('rankThisWeek', () => {
  it('returns nothing when there are no tasks', () => {
    expect(rankThisWeek(semester([]))).toEqual([]);
  });

  it('leaves out anything already done', () => {
    const ranked = rankThisWeek(
      semester([
        task({ id: 'done', done: true }),
        task({ id: 'todo', done: false }),
      ])
    );
    expect(ranked.map((t) => t.id)).toEqual(['todo']);
  });

  it('puts overdue work first', () => {
    const ranked = rankThisWeek(
      semester(
        [
          task({ id: 'soon', dueWeek: 5 }),
          task({ id: 'late', dueWeek: 3 }),
        ],
        5
      )
    );
    expect(ranked[0].id).toBe('late');
  });

  it('orders the rest by due week', () => {
    const ranked = rankThisWeek(
      semester(
        [
          task({ id: 'later', dueWeek: 9 }),
          task({ id: 'sooner', dueWeek: 6 }),
        ],
        5
      )
    );
    expect(ranked.map((t) => t.id)).toEqual(['sooner', 'later']);
  });

  it('puts the bigger job first when two things are due the same week', () => {
    const ranked = rankThisWeek(
      semester(
        [
          task({ id: 'small', dueWeek: 6, estimatedHours: 1 }),
          task({ id: 'big', dueWeek: 6, estimatedHours: 8 }),
        ],
        5
      )
    );
    expect(ranked.map((t) => t.id)).toEqual(['big', 'small']);
  });

  it('treats an unestimated task as the smallest job', () => {
    const ranked = rankThisWeek(
      semester(
        [
          task({ id: 'unknown', dueWeek: 6, estimatedHours: null }),
          task({ id: 'known', dueWeek: 6, estimatedHours: 1 }),
        ],
        5
      )
    );
    expect(ranked.map((t) => t.id)).toEqual(['known', 'unknown']);
  });
});

describe('absencesRemaining', () => {
  it('returns null when the course has no attendance policy', () => {
    expect(absencesRemaining(course({ attendance: null }))).toBeNull();
  });

  it('subtracts absences used from the allowance', () => {
    expect(absencesRemaining(course({ attendance: { allowed: 4, used: 1 } }))).toBe(3);
  });

  it('never goes below zero', () => {
    expect(absencesRemaining(course({ attendance: { allowed: 2, used: 5 } }))).toBe(0);
  });
});

describe('groupThisWeek', () => {
  const now = 5;
  const tasks = [
    task({ id: 'late', title: 'Late', dueWeek: 3 }),
    task({ id: 'now', title: 'Now', dueWeek: 5 }),
    task({ id: 'next', title: 'Next', dueWeek: 6 }),
    task({ id: 'later', title: 'Later', dueWeek: 9 }),
    task({ id: 'done', title: 'Done', dueWeek: 5, done: true }),
  ];

  it('groups outstanding work as overdue, due this week, then next week', () => {
    const groups = groupThisWeek(semester(tasks, now));
    expect(groups.map((g) => g.label)).toEqual(['Overdue', 'Due this week', 'Next week']);
    expect(groups.map((g) => g.tasks.map((t) => t.id))).toEqual([['late'], ['now'], ['next']]);
  });

  it('leaves out work due later, and finished work', () => {
    const ids = groupThisWeek(semester(tasks, now)).flatMap((g) => g.tasks.map((t) => t.id));
    expect(ids).not.toContain('later');
    expect(ids).not.toContain('done');
  });

  it('leaves out groups with nothing in them', () => {
    const groups = groupThisWeek(semester([task({ dueWeek: 5 })], now));
    expect(groups.map((g) => g.key)).toEqual(['thisWeek']);
  });

  it('is empty when nothing is left', () => {
    expect(groupThisWeek(semester([], now))).toEqual([]);
  });

  it('orders inside a group by soonest due, then bigger job, then title', () => {
    const inGroup = [
      task({ id: 'b', title: 'B', dueWeek: 5, estimatedHours: 2 }),
      task({ id: 'a', title: 'A', dueWeek: 5, estimatedHours: 2 }),
      task({ id: 'big', title: 'Z', dueWeek: 5, estimatedHours: 9 }),
    ];
    const [group] = groupThisWeek(semester(inGroup, now));
    expect(group.tasks.map((t) => t.id)).toEqual(['big', 'a', 'b']);
  });
});

describe('comingUp', () => {
  it('orders by when the work needs to start, not only by due date', () => {
    // capacity 15: the 40-hour project needs three weeks, so it starts in
    // week 4 even though it is due after the small one.
    const tasks = [
      task({ id: 'small', title: 'Small', dueWeek: 6, estimatedHours: 2 }),
      task({ id: 'big', title: 'Big', dueWeek: 7, estimatedHours: 40 }),
    ];
    expect(comingUp(semester(tasks, 3), 4).map((t) => t.id)).toEqual(['big', 'small']);
  });

  it('leaves out overdue and finished work', () => {
    const tasks = [
      task({ id: 'late', dueWeek: 2 }),
      task({ id: 'done', dueWeek: 6, done: true }),
      task({ id: 'ok', dueWeek: 6 }),
    ];
    expect(comingUp(semester(tasks, 3), 4).map((t) => t.id)).toEqual(['ok']);
  });

  it('stops at the limit', () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => task({ id: `t${n}`, title: `T${n}`, dueWeek: 5 + n }));
    expect(comingUp(semester(tasks, 3), 4)).toHaveLength(4);
  });

  it('keeps work with no estimate, planned from its due week', () => {
    const tasks = [task({ id: 'none', dueWeek: 4, estimatedHours: null })];
    expect(comingUp(semester(tasks, 3), 4).map((t) => t.id)).toEqual(['none']);
  });
});

describe('attendanceStatus', () => {
  const withAbsences = (allowed: number, used: number) =>
    course({ attendance: { allowed, used } });

  it('says "no policy" for a course without one, which is not the same as zero left', () => {
    expect(attendanceStatus(course({ attendance: null }))).toEqual({ label: 'no policy', tone: 'none' });
    expect(attendanceStatus(withAbsences(2, 2))).toEqual({ label: '0 left', tone: 'heavy' });
  });

  it('warns when only one or two absences are left', () => {
    expect(attendanceStatus(withAbsences(3, 2))).toEqual({ label: '1 absence', tone: 'moderate' });
    expect(attendanceStatus(withAbsences(4, 2))).toEqual({ label: '2 absences', tone: 'moderate' });
  });

  it('is calm with three or more left', () => {
    expect(attendanceStatus(withAbsences(4, 1))).toEqual({ label: '3 absences', tone: 'calm' });
  });
});

describe('startsNow', () => {
  it('flags work that is not yet due but whose start week has arrived', () => {
    // 30 hours at 15 a week needs two weeks, so due week 5 starts in week 4.
    expect(startsNow(task({ dueWeek: 5, estimatedHours: 30 }), 4, 15)).toBe(true);
  });

  it('also flags work whose spread-out effort has already begun', () => {
    // 6 hours spread over two weeks, due week 4: the work begins in week 3.
    expect(startsNow(task({ dueWeek: 4, estimatedHours: 6, spreadWeeks: 2 }), 3, 15)).toBe(true);
  });

  it('does not flag work whose start week is still ahead', () => {
    expect(startsNow(task({ dueWeek: 9, estimatedHours: 4 }), 4, 15)).toBe(false);
  });

  it('never flags work due this week or overdue', () => {
    expect(startsNow(task({ dueWeek: 4, estimatedHours: 4 }), 4, 15)).toBe(false);
    expect(startsNow(task({ dueWeek: 2, estimatedHours: 4 }), 4, 15)).toBe(false);
  });

  it('cannot flag work with no estimate', () => {
    expect(startsNow(task({ dueWeek: 6, estimatedHours: null }), 4, 15)).toBe(false);
  });
});
