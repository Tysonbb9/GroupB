import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import { theme } from '../theme';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function renderSemester(semester: Semester = wallSemester) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
    </SemesterProvider>
  );
}

const detail = () => within(screen.getByTestId('week-detail'));

describe('US-25 (visual depiction): where assignments fall on which weeks', () => {
  it('starts on the current week', () => {
    renderSemester();
    expect(screen.getByTestId('week-detail')).toHaveTextContent(/Week 3 · 0 hours/);
  });

  it('shows the assignments behind a week when its bar is tapped', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-6'));

    expect(detail().getByText('Big project')).toBeTruthy();
    expect(detail().getByText('Midterm')).toBeTruthy();
  });

  it('gives the hours each assignment adds to that week, biggest first', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-6'));

    const rows = detail().getAllByText(/ hrs$/).map((node) => node.props.children);
    expect(rows).toEqual(['10 hrs', '8 hrs']);
  });

  it('adds up to the height of the bar it came from', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-6'));
    expect(screen.getByTestId('week-detail')).toHaveTextContent(/Week 6 · 18 hours/);
  });

  it('shows a spread-out assignment in every week it covers', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-5'));
    expect(detail().getByText('Big project')).toBeTruthy();
  });

  it('shows half hours so the parts still add up to the week', () => {
    renderSemester({
      ...wallSemester,
      tasks: [
        { id: 'a', courseId: 'c1', title: 'Odd one', dueWeek: 4, estimatedHours: 9, spreadWeeks: 2, done: false },
      ],
    });
    fireEvent.press(screen.getByTestId('week-bar-4'));
    expect(detail().getByText('4.5 hrs')).toBeTruthy();
  });

  it('names the course of each assignment', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-7'));
    expect(detail().getByText('CS 262')).toBeTruthy();
  });

  it('says so when nothing lands in the week', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-12'));
    expect(screen.getByTestId('week-detail')).toHaveTextContent(/Nothing lands in week 12/);
  });

  it('leaves out finished work', () => {
    renderSemester();
    fireEvent.press(screen.getByTestId('week-bar-5'));
    expect(detail().queryByText('Old quiz')).toBeNull();
  });

  it('outlines the selected week instead of the current one', () => {
    renderSemester();
    expect(screen.getByTestId('week-bar-3')).toHaveStyle({ borderColor: theme.ink });

    fireEvent.press(screen.getByTestId('week-bar-6'));

    expect(screen.getByTestId('week-bar-6')).toHaveStyle({ borderColor: theme.ink });
    expect(screen.getByTestId('week-bar-3')).not.toHaveStyle({ borderColor: theme.ink });
  });
});
