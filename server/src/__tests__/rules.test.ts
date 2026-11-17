import { isValidHours, MAX_HOURS, MAX_WEEKLY_CAPACITY, WEEKS_IN_SEMESTER } from '../rules';

/**
 * The limits code checks, shared by the routes and matching the database's
 * CHECK constraints, so a value the API accepts can always be saved.
 */

describe('MAX_WEEKLY_CAPACITY', () => {
  it('is the weekly hours limit (US-32), which week_hours uses too: 80', () => {
    expect(MAX_WEEKLY_CAPACITY).toBe(80);
  });
});

describe('WEEKS_IN_SEMESTER', () => {
  it('is 15, as the client and the database use', () => {
    expect(WEEKS_IN_SEMESTER).toBe(15);
  });
});

describe('isValidHours', () => {
  it.each([0.5, 1, 99.5, MAX_HOURS])('accepts %p', (hours) => {
    expect(isValidHours(hours)).toBe(true);
  });

  it.each([0, -1, MAX_HOURS + 0.5, NaN, '3', null, undefined])('refuses %p', (hours) => {
    expect(isValidHours(hours)).toBe(false);
  });
});
