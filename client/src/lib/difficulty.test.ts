import { Semester } from './types';
import {
  LOOKAHEAD_WEEKS,
  SPIKE_SHARE,
  courseSpikes,
  upcomingSpikes,
} from './difficulty';

const semester: Semester = {
  label: 'Test term',
  currentWeek: 3,
  weeklyCapacity: 10,
  courses: [
    { id: 'quiet', code: 'QUIET 101', name: 'Quiet course', attendance: null },
    { id: 'busy', code: 'BUSY 201', name: 'Busy course', attendance: null },
  ],
  tasks: [
    { id: 'exact', courseId: 'quiet', title: 'At threshold', dueWeek: 4, estimatedHours: 3, done: false },
    { id: 'spread', courseId: 'busy', title: 'Project', dueWeek: 5, estimatedHours: 8, spreadWeeks: 2, done: false },
    { id: 'done', courseId: 'busy', title: 'Finished', dueWeek: 6, estimatedHours: 20, done: true },
    { id: 'unknown', courseId: 'busy', title: 'No estimate', dueWeek: 6, estimatedHours: null, done: false },
    { id: 'later', courseId: 'busy', title: 'Later work', dueWeek: 8, estimatedHours: 5, done: false },
  ],
};

describe('courseSpikes', () => {
  it('uses a named 30 percent share and requires more than the threshold', () => {
    expect(SPIKE_SHARE).toBe(0.3);
    const [quiet] = courseSpikes(semester);
    expect(quiet.spikes).toEqual([]);
  });

  it('finds each course week over its share of capacity and identifies the peak', () => {
    const busy = courseSpikes(semester)[1];
    expect(busy.spikes).toEqual([
      { week: 4, hours: 4 },
      { week: 5, hours: 4 },
      { week: 8, hours: 5 },
    ]);
    expect(busy.peakWeek).toBe(8);
    expect(busy.peakHours).toBe(5);
  });

  it('spreads projects and ignores done and unestimated work', () => {
    const busy = courseSpikes(semester)[1];
    expect(busy.spikes).not.toContainEqual({ week: 6, hours: expect.any(Number) });
    expect(busy.spikes.slice(0, 2)).toEqual([
      { week: 4, hours: 4 },
      { week: 5, hours: 4 },
    ]);
  });
});

describe('upcomingSpikes', () => {
  it('keeps this week through three weeks ahead, sorted nearest first', () => {
    expect(LOOKAHEAD_WEEKS).toBe(3);
    const notices = upcomingSpikes(courseSpikes(semester), semester.currentWeek);
    expect(notices.map(({ week }) => week)).toEqual([4, 5]);
  });

  it('shows no more than three notices', () => {
    const summaries = courseSpikes({
      ...semester,
      tasks: [3, 4, 5, 6].map((week) => ({
        id: `busy-${week}`,
        courseId: 'busy',
        title: `Week ${week}`,
        dueWeek: week,
        estimatedHours: 5,
        done: false,
      })),
    });
    expect(upcomingSpikes(summaries, 3)).toHaveLength(3);
  });
});
