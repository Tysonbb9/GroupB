import { render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import { theme } from '../theme';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * One week in each load band, for a capacity of 12 hours:
 *   week 1:  3h  calm
 *   week 2:  8h  calm      (exactly two-thirds of capacity)
 *   week 3: 10h  moderate  (the current week)
 *   week 4: 12h  moderate  (exactly at capacity, so it fits)
 *   week 5: 13h  heavy     (the next wall)
 * Finished work must not count towards any of them.
 */
const fixture: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 12,
  courses: [{ id: 'c1', code: 'CS 262', name: 'Software Engineering', attendance: null }],
  tasks: [
    { id: 'w1', courseId: 'c1', title: 'A', dueWeek: 1, estimatedHours: 3, done: false },
    { id: 'w2', courseId: 'c1', title: 'B', dueWeek: 2, estimatedHours: 8, done: false },
    { id: 'w3', courseId: 'c1', title: 'C', dueWeek: 3, estimatedHours: 10, done: false },
    { id: 'w4', courseId: 'c1', title: 'D', dueWeek: 4, estimatedHours: 12, done: false },
    { id: 'w5', courseId: 'c1', title: 'E', dueWeek: 5, estimatedHours: 13, done: false },
    { id: 'gone', courseId: 'c1', title: 'F', dueWeek: 2, estimatedHours: 40, done: true },
  ],
};

function renderSemester(semester: Semester = fixture) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
    </SemesterProvider>
  );
}

describe('US-01: view estimated workload for each of the 15 weeks', () => {
  it('draws one bar for every week of the semester', () => {
    renderSemester();
    for (let week = 1; week <= 15; week++) {
      expect(screen.getByTestId(`week-bar-${week}`)).toBeTruthy();
    }
  });

  it('labels each bar with its week and projected hours', () => {
    renderSemester();
    expect(screen.getByLabelText('Week 1, 3 hours')).toBeTruthy();
    expect(screen.getByLabelText('Week 5, 13 hours')).toBeTruthy();
  });

  it('shows a week with no work as zero hours', () => {
    renderSemester();
    expect(screen.getByLabelText('Week 15, 0 hours')).toBeTruthy();
  });

  it('leaves finished work out of the projection', () => {
    renderSemester();
    // The 40-hour task in week 2 is done, so week 2 holds only its 8 hours.
    expect(screen.getByLabelText('Week 2, 8 hours')).toBeTruthy();
  });

  it('numbers the axis from 1 to 15', () => {
    renderSemester();
    expect(screen.getByTestId('week-axis-1')).toHaveTextContent('1');
    expect(screen.getByTestId('week-axis-15')).toHaveTextContent('15');
  });
});

describe('US-02: see how many hours are available each week', () => {
  it('states the hours landing this week against the hours available', () => {
    renderSemester();
    expect(screen.getByTestId('figure-this-week')).toHaveTextContent(/10 \/ 12 hrs/);
  });

  it('labels the figure for screen readers', () => {
    renderSemester();
    expect(screen.getByLabelText('This week: 10 of 12 hours')).toBeTruthy();
  });

  it('names the weekly capacity beside the dashed line', () => {
    renderSemester();
    expect(screen.getByText('Dashed line is your 12 hours a week')).toBeTruthy();
  });
});

describe('US-03: compare estimated workload against weekly capacity', () => {
  it('colours a week at or below two-thirds of capacity as calm', () => {
    renderSemester();
    expect(screen.getByTestId('week-bar-1')).toHaveStyle({ backgroundColor: theme.calm });
    expect(screen.getByTestId('week-bar-2')).toHaveStyle({ backgroundColor: theme.calm });
  });

  it('colours a week above two-thirds and up to capacity as moderate', () => {
    renderSemester();
    expect(screen.getByTestId('week-bar-3')).toHaveStyle({ backgroundColor: theme.moderate });
    expect(screen.getByTestId('week-bar-4')).toHaveStyle({ backgroundColor: theme.moderate });
  });

  it('colours a week over capacity as heavy', () => {
    renderSemester();
    expect(screen.getByTestId('week-bar-5')).toHaveStyle({ backgroundColor: theme.heavy });
  });

  it('outlines the current week and marks it on the axis', () => {
    renderSemester();
    expect(screen.getByTestId('week-bar-3')).toHaveStyle({ borderColor: theme.ink });
    expect(screen.getByTestId('week-axis-3')).toHaveStyle({ color: theme.accent });
    expect(screen.getByTestId('week-bar-4')).not.toHaveStyle({ borderColor: theme.ink });
  });

  it('marks the next week over capacity on the axis and in the figures', () => {
    renderSemester();
    expect(screen.getByTestId('week-axis-5')).toHaveStyle({ color: theme.heavy });
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/wk 5/);
  });

  it('states both figures for the next wall in words', () => {
    renderSemester();
    const card = screen.getByTestId('crunch-summary');
    expect(card).toHaveTextContent(/Week 5 needs 13 hours/);
    expect(card).toHaveTextContent(/You have 12 free that week/);
  });

  it('says so when every remaining week fits', () => {
    renderSemester({
      ...fixture,
      tasks: fixture.tasks.filter((task) => task.id !== 'w5'),
    });
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/none/);
    expect(screen.getByTestId('crunch-summary')).toHaveTextContent(
      /Nothing over capacity ahead/
    );
  });

  it('ignores a wall that is already in the past', () => {
    renderSemester({ ...fixture, currentWeek: 6 });
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/none/);
  });
});
