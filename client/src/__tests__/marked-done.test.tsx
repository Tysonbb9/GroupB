import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import WeekScreen from '../app/(tabs)/week';
import { addReview } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// No server in these tests: addReview is replaced with a fake.
jest.mock('../lib/api', () => ({ addReview: jest.fn() }));
const addReviewMock = addReview as jest.MockedFunction<typeof addReview>;

jest.setTimeout(30000);

beforeEach(() => {
  addReviewMock.mockReset();
  addReviewMock.mockResolvedValue({ id: 'review-1', courseId: 'c2', title: 'Midterm', hours: 6, comment: '' });
});

/**
 * Week 5: Discussion post is overdue, and the Midterm and the Big project
 * are under "Next week". "Old quiz" is already done.
 */
function renderWeek() {
  render(
    <SemesterProvider initial={{ ...wallSemester, currentWeek: 5 }}>
      <WeekScreen />
    </SemesterProvider>
  );
}

const tick = (title: string) =>
  fireEvent.press(screen.getByRole('checkbox', { name: `Mark ${title} done` }));
const completedLine = () => screen.getByRole('button', { name: /^Completed,/ });

/** An element on screen, as the queries return it. */
type Element = ReturnType<typeof screen.getByTestId>;

/** The element drawn straight after `element`, among its parent's children. */
function nextSibling(element: Element): Element {
  // Climb to the TaskRow itself: its parent holds the group's rows.
  let row = element;
  while (row.parent !== null && row.parent.children.length === 1) row = row.parent;
  const siblings = row.parent!.children as Element[];
  return siblings[siblings.indexOf(row) + 1];
}

describe('US-45: the hours question on the task just finished', () => {
  it('keeps the ticked task in its place, marked done, with Undo', () => {
    renderWeek();
    tick('Midterm');

    expect(screen.getByTestId('row-exam')).toBeTruthy();
    expect(screen.getByText('Marked done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo marking Midterm done' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Mark Midterm not done' })).toBeChecked();
    // Not in Completed yet: only "Old quiz" is there.
    expect(completedLine()).toHaveTextContent(/Completed \(1\)/);
  });

  it('asks how long it took directly under the ticked task', () => {
    renderWeek();
    tick('Midterm');

    const under = nextSibling(screen.getByTestId('row-exam'));
    expect(within(under).getByText('Midterm is done.')).toBeTruthy();
    expect(within(under).getByTestId('hours-review')).toBeTruthy();
  });

  it('takes the hours off the figures straight away', () => {
    renderWeek();
    expect(screen.getByTestId('items-left')).toHaveTextContent(/3 items/);
    tick('Midterm');
    expect(screen.getByTestId('items-left')).toHaveTextContent(/2 items/);
  });

  it('moves the task to Completed when the question is skipped', () => {
    renderWeek();
    tick('Midterm');
    fireEvent.press(screen.getByText('Skip'));

    expect(screen.queryByTestId('row-exam')).toBeNull();
    expect(screen.queryByTestId('hours-review')).toBeNull();
    expect(completedLine()).toHaveTextContent(/Completed \(2\)/);
    expect(addReviewMock).not.toHaveBeenCalled();
  });

  it('moves the task to Completed when the hours are saved and the card closed', async () => {
    renderWeek();
    tick('Midterm');
    fireEvent.changeText(screen.getByTestId('hours-review-input'), '6');
    await act(async () => {
      fireEvent.press(screen.getByTestId('hours-review-save'));
    });

    // Still in place while the thank-you shows.
    expect(screen.getByTestId('hours-review-saved')).toBeTruthy();
    expect(screen.getByTestId('row-exam')).toBeTruthy();

    fireEvent.press(screen.getByText('Close'));
    expect(screen.queryByTestId('row-exam')).toBeNull();
    expect(completedLine()).toHaveTextContent(/Completed \(2\)/);
  });

  it('Undo puts the task back as not done and hides the question', () => {
    renderWeek();
    tick('Midterm');
    fireEvent.press(screen.getByRole('button', { name: 'Undo marking Midterm done' }));

    expect(screen.queryByText('Marked done')).toBeNull();
    expect(screen.queryByTestId('hours-review')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Mark Midterm done' })).not.toBeChecked();
    expect(screen.getByTestId('items-left')).toHaveTextContent(/3 items/);
    expect(completedLine()).toHaveTextContent(/Completed \(1\)/);
  });

  it('tapping the filled circle again also undoes it', () => {
    renderWeek();
    tick('Midterm');
    fireEvent.press(screen.getByTestId('done-exam'));

    expect(screen.queryByTestId('hours-review')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Mark Midterm done' })).not.toBeChecked();
  });

  it('ticking another task moves the first to Completed and asks about the new one', () => {
    renderWeek();
    tick('Midterm');
    tick('Big project');

    expect(screen.queryByTestId('row-exam')).toBeNull();
    expect(screen.getByText('Big project is done.')).toBeTruthy();
    expect(screen.queryByText('Midterm is done.')).toBeNull();
    expect(completedLine()).toHaveTextContent(/Completed \(2\)/);
  });
});
