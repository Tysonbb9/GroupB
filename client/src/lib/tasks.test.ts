import { rankThisWeek, absencesRemaining } from './tasks';
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
