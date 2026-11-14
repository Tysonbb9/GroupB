import {
  CHECKIN_ANSWERS,
  coursePoliciesProblem,
  gradeWeightsProblem,
  MAX_WEEKLY_CAPACITY,
  weekHoursProblem,
} from '../rules';

/**
 * The rules from docs/DATABASE_DESIGN.md that code checks (#144). The
 * database checks each row on its own; these check what one row cannot
 * see, such as weights adding up to 100%, and give a message the app can
 * show. The database's CHECK constraints use the same limits.
 */

const weight = (name: string, percent: number, detail: string | null = null) => ({ name, detail, percent });

describe('gradeWeightsProblem', () => {
  it('accepts weights that add up to 100%', () => {
    expect(
      gradeWeightsProblem([weight('Team work', 40), weight('Exams', 30), weight('Participation', 20), weight('Quizzes', 10)])
    ).toBeNull();
  });

  it('accepts a single part worth 100%', () => {
    expect(gradeWeightsProblem([weight('Final exam', 100)])).toBeNull();
  });

  it('accepts decimals that add up to 100% (12.5 x 8)', () => {
    expect(gradeWeightsProblem(Array.from({ length: 8 }, (_, i) => weight(`Lab ${i + 1}`, 12.5)))).toBeNull();
  });

  it('accepts thirds that only reach 100% after rounding (33.33 + 33.33 + 33.34)', () => {
    expect(gradeWeightsProblem([weight('A', 33.33), weight('B', 33.33), weight('C', 33.34)])).toBeNull();
  });

  it('accepts no weights at all: the syllabus may not list any', () => {
    expect(gradeWeightsProblem([])).toBeNull();
  });

  it('refuses weights that add up to less than 100%, saying the total (the mockup: 95%)', () => {
    expect(
      gradeWeightsProblem([weight('Team work', 40), weight('Exams', 30), weight('Participation', 15), weight('Quizzes', 10)])
    ).toBe('The grade weights must add up to 100%. They add up to 95%.');
  });

  it('refuses weights that add up to more than 100%', () => {
    expect(gradeWeightsProblem([weight('A', 60), weight('B', 50)])).toBe(
      'The grade weights must add up to 100%. They add up to 110%.'
    );
  });

  it('shows a decimal total as it is', () => {
    expect(gradeWeightsProblem([weight('A', 50), weight('B', 49.5)])).toBe(
      'The grade weights must add up to 100%. They add up to 99.5%.'
    );
  });

  it.each([0, -5, 100.5, NaN, Infinity])('refuses a part worth %p%', (percent) => {
    expect(gradeWeightsProblem([weight('Exams', percent), weight('Rest', 100)])).toBe(
      'Weight 1 (Exams) must be more than 0% and at most 100%.'
    );
  });

  it('refuses a part that is not a number at all', () => {
    expect(gradeWeightsProblem([weight('Exams', '40' as unknown as number), weight('Rest', 60)])).toBe(
      'Weight 1 (Exams) must be more than 0% and at most 100%.'
    );
  });

  it('refuses a part with no name, numbering it from 1', () => {
    expect(gradeWeightsProblem([weight('Exams', 50), weight('   ', 50)])).toBe('Weight 2 needs a name.');
  });

  it('refuses two parts with the same name, ignoring case and spaces', () => {
    expect(gradeWeightsProblem([weight('Exams', 50), weight(' exams ', 50)])).toBe(
      'Weight 2 (exams) has the same name as weight 1.'
    );
  });

  it('accepts a detail line, or none', () => {
    expect(gradeWeightsProblem([weight('Exams', 60, 'two midterms'), weight('Quizzes', 40, null)])).toBeNull();
  });
});

describe('weekHoursProblem', () => {
  it('accepts whole hours from 1 to the weekly limit, in any week from 1 to 15', () => {
    expect(weekHoursProblem(1, 1)).toBeNull();
    expect(weekHoursProblem(15, MAX_WEEKLY_CAPACITY)).toBeNull();
    expect(weekHoursProblem(6, 20)).toBeNull();
  });

  it('uses the same limit as the weekly hours (US-32): 80', () => {
    expect(MAX_WEEKLY_CAPACITY).toBe(80);
  });

  it.each([0, 16, 2.5, -1, NaN])('refuses week %p', (week) => {
    expect(weekHoursProblem(week, 10)).toBe('week must be a whole number from 1 to 15');
  });

  it.each([0, 81, 2.5, -1, NaN, Infinity])('refuses %p hours', (hours) => {
    expect(weekHoursProblem(3, hours)).toBe('hours must be a whole number of hours from 1 to 80');
  });

  it('refuses hours that are not a number', () => {
    expect(weekHoursProblem(3, '10' as unknown as number)).toBe('hours must be a whole number of hours from 1 to 80');
  });
});

describe('coursePoliciesProblem', () => {
  it('accepts the mockup: 10% off a day for up to 2 days, drop the lowest quiz', () => {
    expect(coursePoliciesProblem({ late: { percentPerDay: 10, maxDays: 2 }, dropRule: 'lowest quiz' })).toBeNull();
  });

  it('accepts a course with neither rule', () => {
    expect(coursePoliciesProblem({ late: null, dropRule: null })).toBeNull();
  });

  it.each([0, -10, 100.5, NaN])('refuses a late penalty of %p% a day', (percentPerDay) => {
    expect(coursePoliciesProblem({ late: { percentPerDay, maxDays: 2 }, dropRule: null })).toBe(
      'The late penalty must be more than 0% and at most 100% a day.'
    );
  });

  it.each([0, -1, 1.5, NaN])('refuses %p late days', (maxDays) => {
    expect(coursePoliciesProblem({ late: { percentPerDay: 10, maxDays }, dropRule: null })).toBe(
      'Late work must be accepted for a whole number of days, at least 1.'
    );
  });

  it('refuses a drop rule of only spaces: no rule is null', () => {
    expect(coursePoliciesProblem({ late: null, dropRule: '  ' })).toBe(
      'The drop rule is empty. Leave it out if the course has none.'
    );
  });
});

describe('CHECKIN_ANSWERS', () => {
  it('lists the three answers from the check-in mockup', () => {
    // "Yes, still accurate", "Something changed", and "None of these" after it.
    expect(CHECKIN_ANSWERS).toEqual(['on-schedule', 'changed', 'none-of-these']);
  });
});
