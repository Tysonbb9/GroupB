import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.setTimeout(30000);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * Week 5, so the Midterm and the Big project (both due week 6) are on the
 * This week screen under "Next week". The Big project is spread over two
 * weeks, so 10 of its 20 hours land in week 5 and 10 in week 6.
 */
const semesterInWeek5 = { ...wallSemester, currentWeek: 5 };

/** Both screens under one provider, which is how the app runs them. */
function renderApp(semester = semesterInWeek5) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
      <WeekScreen />
    </SemesterProvider>
  );
}

// Found by role and name, so the tests also hold the accessibility the
// controls promise: a button that says whether it is open, and a checked box.
const completedLine = () => screen.getByRole('button', { name: /^Completed,/ });
const undoBox = (title: string) => screen.getByRole('checkbox', { name: `Mark ${title} not done` });
const openCompleted = () => fireEvent.press(completedLine());

describe('US-31: undo marking a task as done', () => {
  it('counts the finished tasks on a Completed line, closed by default', () => {
    renderApp();
    // "Old quiz" is already done in the fixture.
    expect(completedLine()).toHaveTextContent(/Completed \(1\)/);
    expect(completedLine()).toHaveAccessibleName('Completed, 1 task');
    expect(completedLine()).not.toBeExpanded();
    expect(screen.queryByRole('checkbox', { name: 'Mark Old quiz not done' })).toBeNull();
  });

  it('opens to list the finished tasks, checked, and closes again', () => {
    renderApp();
    openCompleted();
    expect(completedLine()).toBeExpanded();
    expect(screen.getByText('Old quiz')).toBeTruthy();
    expect(undoBox('Old quiz')).toBeChecked();

    openCompleted();
    expect(completedLine()).not.toBeExpanded();
    expect(screen.queryByText('Old quiz')).toBeNull();
  });

  it('moves a task to Completed when it is marked done', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('done-exam'));
    expect(screen.queryByTestId('row-exam')).toBeNull();
    expect(completedLine()).toHaveTextContent(/Completed \(2\)/);
    openCompleted();
    expect(undoBox('Midterm')).toBeChecked();
  });

  it('puts the task back in This week when it is marked not done', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('done-exam'));
    openCompleted();
    fireEvent.press(undoBox('Midterm'));
    expect(screen.getByTestId('row-exam')).toBeTruthy();
    expect(completedLine()).toHaveTextContent(/Completed \(1\)/);
  });

  it("returns its hours to this week's figure and to the forecast", () => {
    renderApp();
    // Week 5 holds half the Big project; week 6 holds the other half and the Midterm.
    expect(screen.getByLabelText('10 of 10 hours land this week')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();

    fireEvent.press(screen.getByTestId('done-proj'));
    expect(screen.getByLabelText('0 of 10 hours land this week')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 8 hours')).toBeTruthy();

    openCompleted();
    fireEvent.press(undoBox('Big project'));
    expect(screen.getByLabelText('10 of 10 hours land this week')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    // Left to do: Discussion post, Big project and Midterm.
    expect(screen.getByTestId('items-left')).toHaveTextContent(/3 items/);
  });

  it('removes the Completed line when the last finished task is undone', () => {
    renderApp();
    openCompleted();
    fireEvent.press(undoBox('Old quiz'));
    expect(screen.queryByRole('button', { name: /^Completed,/ })).toBeNull();
  });

  it('shows nothing to open when no task is done', () => {
    render(
      <SemesterProvider
        initial={{ ...wallSemester, tasks: wallSemester.tasks.filter((t) => !t.done) }}
      >
        <WeekScreen />
      </SemesterProvider>
    );
    expect(screen.queryByRole('button', { name: /^Completed,/ })).toBeNull();
  });
});
