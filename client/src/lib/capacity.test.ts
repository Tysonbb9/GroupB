import { MAX_WEEKLY_HOURS, MIN_WEEKLY_HOURS, parseWeeklyHours } from './capacity';

describe('parseWeeklyHours (US-32)', () => {
  it.each([
    ['20', 20],
    [' 20 ', 20],
    ['1', 1],
    ['80', 80],
    ['07', 7],
  ])('reads "%s" as %i hours', (text, hours) => {
    expect(parseWeeklyHours(text)).toBe(hours);
  });

  it.each(['', '   ', '0', '81', '12.5', '-5', 'abc', '1e2', '20 hours'])(
    'refuses "%s"',
    (text) => {
      expect(parseWeeklyHours(text)).toBeNull();
    }
  );

  it('uses the same range as the server', () => {
    expect([MIN_WEEKLY_HOURS, MAX_WEEKLY_HOURS]).toEqual([1, 80]);
  });
});
