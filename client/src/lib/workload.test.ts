import {
  assignmentsInWeek,
  crunchPeriodAt,
  detectCrunch,
  exactHours,
  hoursInWeek,
  hoursLabel,
  loadBand,
  nextWall,
  plannedStart,
  recommendStart,
  startBy,
  weeklyLoad,
  wholeHours,
  workSpan,
} from './workload';
import { Task, WEEKS_IN_SEMESTER } from './types';

/** Build a task without spelling out every field each time. */
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

/** Pull the hours for one week out of a WeekLoad[]. */
function hoursIn(loads: ReturnType<typeof weeklyLoad>, week: number): number {
  return loads.find((l) => l.week === week)!.hours;
}

describe('weeklyLoad', () => {
  it('returns one entry per week of the semester', () => {
    const loads = weeklyLoad([]);
    expect(loads).toHaveLength(WEEKS_IN_SEMESTER);
    expect(loads[0].week).toBe(1);
    expect(loads[WEEKS_IN_SEMESTER - 1].week).toBe(WEEKS_IN_SEMESTER);
  });

  it('reports zero hours everywhere when there are no tasks', () => {
    expect(weeklyLoad([]).every((l) => l.hours === 0)).toBe(true);
  });

  it('adds up several tasks landing in the same week', () => {
    const loads = weeklyLoad([
      task({ id: 'a', dueWeek: 3, estimatedHours: 2 }),
      task({ id: 'b', dueWeek: 3, estimatedHours: 5 }),
    ]);
    expect(hoursIn(loads, 3)).toBe(7);
  });

  it('ignores tasks that are already done', () => {
    const loads = weeklyLoad([
      task({ id: 'a', dueWeek: 3, estimatedHours: 6, done: true }),
      task({ id: 'b', dueWeek: 3, estimatedHours: 2, done: false }),
    ]);
    expect(hoursIn(loads, 3)).toBe(2);
  });

  it('counts an unestimated task as zero hours rather than crashing', () => {
    const loads = weeklyLoad([task({ dueWeek: 4, estimatedHours: null })]);
    expect(hoursIn(loads, 4)).toBe(0);
  });

  it('spreads a multi-week task backwards from its due week', () => {
    const loads = weeklyLoad([
      task({ dueWeek: 12, estimatedHours: 12, spreadWeeks: 3 }),
    ]);
    expect(hoursIn(loads, 10)).toBe(4);
    expect(hoursIn(loads, 11)).toBe(4);
    expect(hoursIn(loads, 12)).toBe(4);
    expect(hoursIn(loads, 9)).toBe(0);
  });

  it('keeps the total when a spread would start before week 1', () => {
    const loads = weeklyLoad([
      task({ dueWeek: 2, estimatedHours: 12, spreadWeeks: 5 }),
    ]);
    // Only weeks 1 and 2 exist, so the 12 hours land across those two.
    expect(hoursIn(loads, 1)).toBe(6);
    expect(hoursIn(loads, 2)).toBe(6);
  });

  it('ignores tasks due outside the semester', () => {
    const loads = weeklyLoad([
      task({ dueWeek: 99, estimatedHours: 10 }),
      task({ dueWeek: 0, estimatedHours: 10 }),
    ]);
    expect(loads.every((l) => l.hours === 0)).toBe(true);
  });
});

describe('detectCrunch', () => {
  /** Turn a plain list of hours into WeekLoad[] starting at week 1. */
  function loadsFrom(hours: number[]) {
    return hours.map((h, i) => ({ week: i + 1, hours: h }));
  }

  it('finds nothing when every week is under capacity', () => {
    expect(detectCrunch(loadsFrom([5, 8, 10]), 15)).toEqual([]);
  });

  it('does not flag a week that is exactly at capacity', () => {
    expect(detectCrunch(loadsFrom([15, 15]), 15)).toEqual([]);
  });

  it('flags a single week over capacity', () => {
    const windows = detectCrunch(loadsFrom([5, 20, 5]), 15);
    expect(windows).toHaveLength(1);
    expect(windows[0].startWeek).toBe(2);
    expect(windows[0].endWeek).toBe(2);
  });

  it('merges consecutive over-capacity weeks into one window', () => {
    const windows = detectCrunch(loadsFrom([5, 18, 22, 19, 5]), 15);
    expect(windows).toHaveLength(1);
    expect(windows[0].startWeek).toBe(2);
    expect(windows[0].endWeek).toBe(4);
  });

  it('keeps non-adjacent crunch weeks as separate windows', () => {
    const windows = detectCrunch(loadsFrom([20, 5, 20]), 15);
    expect(windows).toHaveLength(2);
    expect(windows[0].startWeek).toBe(1);
    expect(windows[1].startWeek).toBe(3);
  });

  it('reports the worst week inside each window', () => {
    const windows = detectCrunch(loadsFrom([5, 18, 26, 19]), 15);
    expect(windows[0].peakHours).toBe(26);
  });
});

describe('startBy', () => {
  it('returns null when nobody has estimated the task', () => {
    expect(startBy(task({ estimatedHours: null }), 15)).toBeNull();
  });

  it('says start in the due week when the work fits in one week', () => {
    expect(startBy(task({ dueWeek: 7, estimatedHours: 4 }), 15)).toBe(7);
  });

  it('backs up far enough for work that needs several weeks', () => {
    // 30 hours at 15 hours a week needs 2 weeks, so start in week 11.
    expect(startBy(task({ dueWeek: 12, estimatedHours: 30 }), 15)).toBe(11);
  });

  it('never suggests starting before the semester began', () => {
    expect(startBy(task({ dueWeek: 2, estimatedHours: 90 }), 15)).toBe(1);
  });
});

describe('loadBand', () => {
  it('is calm at or below two-thirds of capacity', () => {
    expect(loadBand(0, 12)).toBe('calm');
    expect(loadBand(8, 12)).toBe('calm');
  });

  it('is moderate above two-thirds, up to and including capacity', () => {
    expect(loadBand(8.1, 12)).toBe('moderate');
    expect(loadBand(12, 12)).toBe('moderate');
  });

  it('is heavy only when the work does not fit', () => {
    expect(loadBand(12.1, 12)).toBe('heavy');
  });

  it('does not misplace the two-thirds boundary for awkward capacities', () => {
    // 15 * 2/3 is exactly 10, which float arithmetic can get wrong.
    expect(loadBand(10, 15)).toBe('calm');
    expect(loadBand(10.5, 15)).toBe('moderate');
  });
});

describe('hoursInWeek', () => {
  const loads = [
    { week: 1, hours: 2 },
    { week: 2, hours: 5 },
  ];

  it('finds the hours for a week', () => {
    expect(hoursInWeek(loads, 2)).toBe(5);
  });

  it('is zero for a week that is not there', () => {
    expect(hoursInWeek(loads, 9)).toBe(0);
  });
});

describe('nextWall', () => {
  const loads = [
    { week: 1, hours: 20 },
    { week: 2, hours: 5 },
    { week: 3, hours: 9 },
    { week: 4, hours: 30 },
  ];

  it('skips walls that are already behind us', () => {
    expect(nextWall(loads, 10, 2)?.week).toBe(4);
  });

  it('counts the current week when it is over capacity', () => {
    expect(nextWall(loads, 10, 1)?.week).toBe(1);
  });

  it('does not treat a week exactly at capacity as a wall', () => {
    expect(nextWall([{ week: 1, hours: 10 }], 10, 1)).toBeNull();
  });

  it('is null when nothing ahead is over capacity', () => {
    expect(nextWall(loads, 10, 5)).toBeNull();
  });
});

describe('wholeHours', () => {
  it('rounds partial hours up so an overloaded week never reads as fitting', () => {
    expect(wholeHours(12.2)).toBe(13);
  });

  it('leaves whole hours alone, even with float noise', () => {
    expect(wholeHours(4)).toBe(4);
    expect(wholeHours(4.0000000001)).toBe(4);
  });
});

describe('workSpan', () => {
  it('reaches back from the due week over the spread', () => {
    expect(workSpan(task({ dueWeek: 6, estimatedHours: 12, spreadWeeks: 3 }))).toEqual({
      firstWeek: 4,
      lastWeek: 6,
      hoursPerWeek: 4,
    });
  });

  it('squeezes work that would start before week 1 into the weeks that exist', () => {
    expect(workSpan(task({ dueWeek: 2, estimatedHours: 8, spreadWeeks: 5 }))).toEqual({
      firstWeek: 1,
      lastWeek: 2,
      hoursPerWeek: 4,
    });
  });

  it('is null for work that puts nothing in the forecast', () => {
    expect(workSpan(task({ done: true }))).toBeNull();
    expect(workSpan(task({ estimatedHours: null }))).toBeNull();
    expect(workSpan(task({ dueWeek: 40 }))).toBeNull();
  });
});

describe('assignmentsInWeek', () => {
  const tasks = [
    task({ id: 'a', title: 'A', dueWeek: 5, estimatedHours: 4 }),
    task({ id: 'b', title: 'B', dueWeek: 5, estimatedHours: 9 }),
    task({ id: 'c', title: 'C', dueWeek: 6, estimatedHours: 8, spreadWeeks: 2 }),
    task({ id: 'd', title: 'D', dueWeek: 5, estimatedHours: 4, done: true }),
    task({ id: 'e', title: 'E', dueWeek: 5, estimatedHours: null }),
  ];

  it('lists what lands in the week, largest share first, ties alphabetical', () => {
    const found = assignmentsInWeek(tasks, 5);
    expect(found.map((f) => f.task.id)).toEqual(['b', 'a', 'c']);
    expect(found.map((f) => f.hours)).toEqual([9, 4, 4]);
  });

  it('includes a spread assignment in each of its weeks', () => {
    expect(assignmentsInWeek(tasks, 6).map((f) => f.task.id)).toEqual(['c']);
  });

  it('leaves out finished and unestimated work', () => {
    const ids = assignmentsInWeek(tasks, 5).map((f) => f.task.id);
    expect(ids).not.toContain('d');
    expect(ids).not.toContain('e');
  });

  it('breaks ties alphabetically so the order is stable', () => {
    const tied = [
      task({ id: 'z', title: 'Zebra', dueWeek: 2, estimatedHours: 3 }),
      task({ id: 'y', title: 'Apple', dueWeek: 2, estimatedHours: 3 }),
    ];
    expect(assignmentsInWeek(tied, 2).map((f) => f.task.title)).toEqual(['Apple', 'Zebra']);
  });

  it('is empty for a quiet week', () => {
    expect(assignmentsInWeek(tasks, 12)).toEqual([]);
  });
});

describe('recommendStart', () => {
  it('picks the assignment adding the most hours to the wall week', () => {
    const tasks = [
      task({ id: 'small', title: 'Small', dueWeek: 6, estimatedHours: 4 }),
      task({ id: 'big', title: 'Big', dueWeek: 6, estimatedHours: 20, spreadWeeks: 2 }),
    ];
    expect(recommendStart(tasks, 6, 10)?.task.id).toBe('big');
  });

  it('starts no later than the week its work already begins', () => {
    const tasks = [task({ dueWeek: 6, estimatedHours: 20, spreadWeeks: 2 })];
    // Spread from week 5; startBy also says week 5 (two weeks at 10 hours).
    expect(recommendStart(tasks, 6, 10)?.startWeek).toBe(5);
  });

  it('starts earlier when the hours need more weeks than the spread allows', () => {
    const tasks = [task({ dueWeek: 8, estimatedHours: 30, spreadWeeks: 2 })];
    // Spread from week 7, but 30 hours at 10 a week needs weeks 6 to 8.
    expect(recommendStart(tasks, 8, 10)?.startWeek).toBe(6);
  });

  it('ignores finished work', () => {
    const tasks = [task({ dueWeek: 6, estimatedHours: 20, done: true })];
    expect(recommendStart(tasks, 6, 10)).toBeNull();
  });

  it('is null when nothing lands in the wall week', () => {
    expect(recommendStart([task({ dueWeek: 2 })], 6, 10)).toBeNull();
  });
});

describe('crunchPeriodAt', () => {
  const loads = [
    { week: 1, hours: 5 },
    { week: 2, hours: 12 },
    { week: 3, hours: 14 },
    { week: 4, hours: 5 },
  ];

  it('returns the whole run of over-capacity weeks containing the week', () => {
    expect(crunchPeriodAt(loads, 10, 2)).toEqual({ startWeek: 2, endWeek: 3, peakHours: 14 });
    expect(crunchPeriodAt(loads, 10, 3)).toEqual({ startWeek: 2, endWeek: 3, peakHours: 14 });
  });

  it('is null for a week that fits', () => {
    expect(crunchPeriodAt(loads, 10, 4)).toBeNull();
  });
});

describe('exactHours', () => {
  it('keeps one decimal place', () => {
    expect(exactHours(4.5)).toBe(4.5);
    expect(exactHours(3.3333)).toBe(3.3);
  });

  it('shows whole hours without a decimal', () => {
    expect(exactHours(6)).toBe(6);
  });
});

describe('plannedStart', () => {
  it('is the week the work already begins when that is earlier', () => {
    expect(plannedStart(task({ dueWeek: 6, estimatedHours: 20, spreadWeeks: 2 }), 10)).toBe(5);
  });

  it('is earlier still when the hours need more weeks than the spread gives', () => {
    expect(plannedStart(task({ dueWeek: 8, estimatedHours: 30, spreadWeeks: 2 }), 10)).toBe(6);
  });

  it('is the due week for a task with no estimate', () => {
    expect(plannedStart(task({ dueWeek: 7, estimatedHours: null }), 10)).toBe(7);
  });
});

describe('hoursLabel', () => {
  it('uses the singular for exactly one hour', () => {
    expect(hoursLabel(1)).toBe('1 hr');
  });

  it('uses the plural otherwise, including for fractions', () => {
    expect(hoursLabel(3)).toBe('3 hrs');
    expect(hoursLabel(2.5)).toBe('2.5 hrs');
    expect(hoursLabel(0.5)).toBe('0.5 hrs');
  });
});
