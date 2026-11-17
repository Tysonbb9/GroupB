import { wallSemester } from '../testing/fixtures';
import { capacityByWeek, ownWeekHours } from './capacity';
import { courseSpikes, upcomingSpikes } from './difficulty';
import { capacityIn, crunchPeriodAt, detectCrunch, nextWall, weeklyLoad } from './workload';

/**
 * #148: a week can have its own hours, replacing the weekly number there.
 * wallSemester has 10 hours a week and its loads are
 *   week 5: 10h, week 6: 18h (the wall), week 7: 14h.
 */

const loads = weeklyLoad(wallSemester.tasks);
const withWeeks = (weekHours: { week: number; hours: number }[]) => ({ ...wallSemester, weekHours });

describe('capacityByWeek', () => {
  it('uses the weekly number when no week has its own hours', () => {
    const capacity = capacityByWeek(wallSemester);
    expect(capacity(1)).toBe(10);
    expect(capacity(15)).toBe(10);
  });

  it("uses a week's own hours in that week only", () => {
    const capacity = capacityByWeek(withWeeks([{ week: 6, hours: 20 }]));
    expect(capacity(6)).toBe(20);
    expect(capacity(5)).toBe(10);
    expect(capacity(7)).toBe(10);
  });

  it('can give a week fewer hours than the weekly number', () => {
    expect(capacityByWeek(withWeeks([{ week: 4, hours: 2 }]))(4)).toBe(2);
  });

  it('treats an empty list like no list', () => {
    expect(capacityByWeek(withWeeks([]))(6)).toBe(10);
  });
});

describe('ownWeekHours', () => {
  it("is the week's own hours, or null when it uses the weekly number", () => {
    const semester = withWeeks([{ week: 6, hours: 20 }]);
    expect(ownWeekHours(semester, 6)).toBe(20);
    expect(ownWeekHours(semester, 7)).toBeNull();
    expect(ownWeekHours(wallSemester, 6)).toBeNull();
  });
});

describe('capacityIn', () => {
  it('takes one number for every week, or a number for each', () => {
    expect(capacityIn(12, 3)).toBe(12);
    expect(capacityIn((week) => week * 2, 3)).toBe(6);
  });
});

describe('the crunch weeks use each week its own hours', () => {
  it('a week given enough hours is no longer a wall', () => {
    const capacity = capacityByWeek(withWeeks([{ week: 6, hours: 20 }]));
    // Week 6 (18h) fits in 20; week 7 (14h) is still over 10.
    expect(nextWall(loads, capacity, 3)?.week).toBe(7);
    expect(detectCrunch(loads, capacity)).toEqual([{ startWeek: 7, endWeek: 7, peakHours: 14 }]);
  });

  it('a week given fewer hours can become the wall', () => {
    const capacity = capacityByWeek(withWeeks([{ week: 5, hours: 8 }]));
    // Week 5 (10h) no longer fits in 8, so the crunch now starts there.
    expect(nextWall(loads, capacity, 3)?.week).toBe(5);
    expect(crunchPeriodAt(loads, capacity, 6)).toEqual({ startWeek: 5, endWeek: 7, peakHours: 18 });
  });

  it('a week exactly at its own hours still fits', () => {
    const capacity = capacityByWeek(withWeeks([{ week: 6, hours: 18 }, { week: 7, hours: 14 }]));
    expect(nextWall(loads, capacity, 3)).toBeNull();
    expect(detectCrunch(loads, capacity)).toEqual([]);
  });

  it('gives the same answers as before with no weeks of their own', () => {
    const capacity = capacityByWeek(wallSemester);
    expect(detectCrunch(loads, capacity)).toEqual(detectCrunch(loads, 10));
    expect(nextWall(loads, capacity, 3)).toEqual(nextWall(loads, 10, 3));
  });
});

describe('the notices use each week its own hours', () => {
  it("a course's week is a spike against that week's own hours", () => {
    // Midterm (MATH 251) is 8h in week 6: over 30% of 10, but not of 30.
    const before = courseSpikes(wallSemester).find((s) => s.course.id === 'c2');
    expect(before?.spikes.map((s) => s.week)).toContain(6);

    const after = courseSpikes(withWeeks([{ week: 6, hours: 30 }])).find((s) => s.course.id === 'c2');
    expect(after?.spikes.map((s) => s.week)).not.toContain(6);
  });

  it('fewer hours in a week can make a new notice', () => {
    // Week 4 has no work in the fixture, so lower hours there add nothing.
    const notices = upcomingSpikes(courseSpikes(withWeeks([{ week: 4, hours: 1 }])), 3);
    expect(notices.every((n) => n.week !== 4)).toBe(true);
    // Week 5's 10h of Big project is a spike at 10; at 40 it is not.
    const quieter = upcomingSpikes(courseSpikes(withWeeks([{ week: 5, hours: 40 }])), 3);
    expect(quieter.some((n) => n.week === 5)).toBe(false);
  });
});
