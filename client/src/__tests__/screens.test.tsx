import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import SemesterScreen from '../app/index';
import WeekScreen from '../app/week';

// The screens only use the router to navigate, which is not what we are
// testing here.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** A small semester we can reason about exactly. */
const fixture: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 10,
  courses: [
    { id: 'c1', code: 'CS 262', name: 'Software Engineering', attendance: { allowed: 4, used: 1 } },
    { id: 'c2', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
  ],
  tasks: [
    { id: 'late', courseId: 'c2', title: 'Syllabus quiz', dueWeek: 2, estimatedHours: 1, done: false },
    { id: 'now', courseId: 'c1', title: 'Vision statement', dueWeek: 3, estimatedHours: 4, done: false },
    { id: 'soon', courseId: 'c1', title: 'Prototype demo', dueWeek: 4, estimatedHours: 2, done: false },
    { id: 'wall', courseId: 'c2', title: 'Midterm 1', dueWeek: 6, estimatedHours: 30, done: false },
    { id: 'gone', courseId: 'c1', title: 'Team contract', dueWeek: 1, estimatedHours: 1, done: true },
  ],
};

function renderWith(ui: React.ReactElement) {
  return render(<SemesterProvider initial={fixture}>{ui}</SemesterProvider>);
}

describe('Semester screen', () => {
  it('names the semester and the week we are in', () => {
    renderWith(<SemesterScreen />);
    expect(screen.getByText('Fall 2026')).toBeTruthy();
    expect(screen.getByText(/Week 3 of 15/)).toBeTruthy();
  });

  it('draws a bar for the first and last week of the semester', () => {
    renderWith(<SemesterScreen />);
    expect(screen.getByTestId('week-bar-1')).toBeTruthy();
    expect(screen.getByTestId('week-bar-15')).toBeTruthy();
  });

  it('warns about the next week that does not fit', () => {
    renderWith(<SemesterScreen />);
    // 30 hours in week 6 against a capacity of 10.
    expect(screen.getByText(/Week 6 is your next wall/)).toBeTruthy();
  });

  it('lists every course', () => {
    renderWith(<SemesterScreen />);
    expect(screen.getByText('CS 262')).toBeTruthy();
    expect(screen.getByText('MATH 251')).toBeTruthy();
  });

  it('says when a course has no attendance policy', () => {
    renderWith(<SemesterScreen />);
    expect(screen.getByText('no attendance policy')).toBeTruthy();
    expect(screen.getByText('3 absences left')).toBeTruthy();
  });
});

describe('Week screen', () => {
  it('shows outstanding work with the overdue item first', () => {
    renderWith(<WeekScreen />);
    const titles = screen
      .getAllByText(/Syllabus quiz|Vision statement|Prototype demo|Midterm 1/)
      .map((node) => node.props.children);
    expect(titles[0]).toBe('Syllabus quiz');
  });

  it('leaves out work that is already done', () => {
    renderWith(<WeekScreen />);
    expect(screen.queryByText('Team contract')).toBeNull();
  });

  it('reports how many hours land this week', () => {
    renderWith(<WeekScreen />);
    // Only the 4-hour vision statement is due in week 3.
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/4 hours of work land this week/);
  });

  it('removes a task from the list once it is marked done', () => {
    renderWith(<WeekScreen />);
    expect(screen.getByText('Vision statement')).toBeTruthy();

    fireEvent.press(screen.getByTestId('done-now'));

    expect(screen.queryByText('Vision statement')).toBeNull();
  });

  it('takes the finished work out of this week’s hours', () => {
    renderWith(<WeekScreen />);
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/^4 hours/);

    fireEvent.press(screen.getByTestId('done-now'));

    expect(screen.getByTestId('week-hours')).toHaveTextContent(/^0 hours/);
  });
});

describe('the two screens together', () => {
  it('lets finishing work on the week screen bring down the wall on the semester screen', () => {
    // Both screens under one provider, which is how the app runs them.
    render(
      <SemesterProvider initial={fixture}>
        <SemesterScreen />
        <WeekScreen />
      </SemesterProvider>
    );

    // The 30-hour midterm in week 6 is the only thing over the 10-hour capacity.
    expect(screen.getByTestId('crunch-summary')).toHaveTextContent(
      /Week 6 is your next wall/
    );

    fireEvent.press(screen.getByTestId('done-wall'));

    expect(screen.getByTestId('crunch-summary')).toHaveTextContent(
      /Nothing over capacity ahead/
    );
  });
});
