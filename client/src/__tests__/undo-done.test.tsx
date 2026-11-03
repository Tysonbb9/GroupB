import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import WeekScreen from '../app/week';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.setTimeout(30000);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * Week 5, so the Midterm and the Big project (both due week 6) are on the
 * This week screen under "Next week", and the forecast shows week 6's hours.
 */
const semesterInWeek5 = { ...wallSemester, currentWeek: 5 };

/** Both screens under one provider, which is how the app runs them. */
function renderApp() {
  return render(
    <SemesterProvider initial={semesterInWeek5}>
      <SemesterScreen />
      <WeekScreen />
    </SemesterProvider>
  );
}

const openCompleted = () => fireEvent.press(screen.getByTestId('completed-toggle'));

describe('US-31: undo marking a task as done', () => {
  it('counts the finished tasks on a Completed line, closed by default', () => {
    renderApp();
    // "Old quiz" is already done in the fixture.
    expect(screen.getByTestId('completed-toggle')).toHaveTextContent(/Completed \(1\)/);
    expect(screen.queryByTestId('undo-gone')).toBeNull();
  });

  it('lists the finished tasks once the Completed line is opened', () => {
    renderApp();
    openCompleted();
    expect(screen.getByText('Old quiz')).toBeTruthy();
    expect(screen.getByTestId('undo-gone')).toBeTruthy();
  });

  it('moves a task to Completed when it is marked done', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('done-exam'));
    expect(screen.queryByTestId('row-exam')).toBeNull();
    expect(screen.getByTestId('completed-toggle')).toHaveTextContent(/Completed \(2\)/);
    openCompleted();
    expect(screen.getByTestId('undo-exam')).toBeTruthy();
  });

  it('puts the task back in This week when it is marked not done', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('done-exam'));
    openCompleted();
    fireEvent.press(screen.getByTestId('undo-exam'));
    expect(screen.getByTestId('row-exam')).toBeTruthy();
    expect(screen.getByTestId('completed-toggle')).toHaveTextContent(/Completed \(1\)/);
  });

  it('returns its hours to the forecast on both screens', () => {
    renderApp();
    // Week 6 holds the Big project (10h) and the Midterm (8h).
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    fireEvent.press(screen.getByTestId('done-exam'));
    expect(screen.getByLabelText('Week 6, 10 hours')).toBeTruthy();

    openCompleted();
    fireEvent.press(screen.getByTestId('undo-exam'));
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    // Left to do: Discussion post, Big project and Midterm.
    expect(screen.getByTestId('items-left')).toHaveTextContent(/3 items/);
  });

  it('shows nothing to open when no task is done', () => {
    render(
      <SemesterProvider
        initial={{ ...wallSemester, tasks: wallSemester.tasks.filter((t) => !t.done) }}
      >
        <WeekScreen />
      </SemesterProvider>
    );
    expect(screen.queryByTestId('completed-toggle')).toBeNull();
  });
});
