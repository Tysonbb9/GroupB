import { weeklyLoad, detectCrunch, startBy } from './workload';
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
