import { gradeWeightsProblem, MAX_WEEKLY_CAPACITY } from '../rules';

/**
 * The rule from docs/DATABASE_DESIGN.md that code checks (#144): a course's
 * grade weights add up to 100%. The database checks each row on its own, so
 * it cannot see the total. The message is what the syllabus screen shows.
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

  it('accepts a detail line, or none', () => {
    expect(gradeWeightsProblem([weight('Exams', 60, 'two midterms'), weight('Quizzes', 40, null)])).toBeNull();
  });
});

describe('MAX_WEEKLY_CAPACITY', () => {
  it('is the weekly hours limit (US-32), which week_hours uses too: 80', () => {
    expect(MAX_WEEKLY_CAPACITY).toBe(80);
  });
});
