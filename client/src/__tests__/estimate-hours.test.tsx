import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import WeekScreen from '../app/week';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** Both screens under one provider, which is how the app runs them. */
function renderApp() {
  return render(
    <SemesterProvider initial={wallSemester}>
      <SemesterScreen />
      <WeekScreen />
    </SemesterProvider>
  );
}

const postRow = () => within(screen.getByTestId('row-post'));

function addEstimate(text: string) {
  fireEvent.press(screen.getByTestId('estimate-open-post'));
  fireEvent.changeText(screen.getByTestId('estimate-input-post'), text);
  fireEvent.press(screen.getByTestId('estimate-save-post'));
}

describe('US-13: keep tasks that do not have an estimated number of hours', () => {
  it('lists a task with no estimate, offering to add one', () => {
    renderApp();
    expect(postRow().getByText('Discussion post')).toBeTruthy();
    expect(screen.getByLabelText('Add estimate for Discussion post')).toBeTruthy();
  });

  it('puts no hours in the forecast for it', () => {
    renderApp();
    // Week 3 holds only the unestimated post, so it stays at zero.
    expect(screen.getByLabelText('Week 3, 0 hours')).toBeTruthy();
  });

  it('only offers an estimate on tasks that do not have one', () => {
    renderApp();
    expect(screen.queryByLabelText('Add estimate for Midterm')).toBeNull();
    expect(screen.queryByLabelText('Edit estimate for Midterm')).toBeNull();
  });
});

describe('US-12: include an estimated number of hours on a task', () => {
  it('shows the estimate on the task once it is saved', () => {
    renderApp();
    addEstimate('3');
    expect(postRow().getByText('3 hrs')).toBeTruthy();
  });

  it('stops offering to add one once it has one', () => {
    renderApp();
    addEstimate('3');
    expect(screen.queryByLabelText('Add estimate for Discussion post')).toBeNull();
  });

  it('adds the hours to the forecast on both screens', () => {
    renderApp();
    addEstimate('3');
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/3 \/ 10 hrs/);
    expect(screen.getByLabelText('Week 3, 3 hours')).toBeTruthy();
  });

  it('accepts half hours', () => {
    renderApp();
    addEstimate('2.5');
    expect(postRow().getByText('2.5 hrs')).toBeTruthy();
  });

  it('rejects text that is not a number, and saves nothing', () => {
    renderApp();
    addEstimate('lots');
    expect(screen.getByTestId('estimate-error-post')).toBeTruthy();
    expect(screen.getByLabelText('Week 3, 0 hours')).toBeTruthy();
  });

  it('rejects zero and absurdly large estimates', () => {
    renderApp();
    addEstimate('0');
    expect(screen.getByTestId('estimate-error-post')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('estimate-input-post'), '500');
    fireEvent.press(screen.getByTestId('estimate-save-post'));
    expect(screen.getByTestId('estimate-error-post')).toBeTruthy();
  });

  it('leaves the task unestimated when the field is left blank', () => {
    renderApp();
    addEstimate('');
    expect(screen.getByLabelText('Add estimate for Discussion post')).toBeTruthy();
  });

  it('leaves the task unestimated when cancelled', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('estimate-open-post'));
    fireEvent.changeText(screen.getByTestId('estimate-input-post'), '9');
    fireEvent.press(screen.getByTestId('estimate-cancel-post'));
    expect(screen.getByLabelText('Add estimate for Discussion post')).toBeTruthy();
    expect(screen.getByLabelText('Week 3, 0 hours')).toBeTruthy();
  });
});
