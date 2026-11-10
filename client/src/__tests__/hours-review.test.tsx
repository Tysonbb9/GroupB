import { act, fireEvent, render, screen } from '@testing-library/react-native';
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
  addReviewMock.mockResolvedValue({ id: 'review-1', courseId: 'c1', title: 'Discussion post', hours: 2.5, comment: '' });
});

function renderWeek() {
  render(
    <SemesterProvider initial={wallSemester}>
      <WeekScreen />
    </SemesterProvider>
  );
}

/** Ticks "Discussion post" (CS 262, due this week) done. */
function tickDone() {
  fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Discussion post done' }));
}

async function saveHours(text: string) {
  fireEvent.changeText(screen.getByTestId('hours-review-input'), text);
  await act(async () => {
    fireEvent.press(screen.getByTestId('hours-review-save'));
  });
}

describe('US-23: store how long a finished assignment took', () => {
  it('asks how long it took as soon as a task is ticked done', () => {
    renderWeek();
    expect(screen.queryByTestId('hours-review')).toBeNull();

    tickDone();
    expect(screen.getByText('Discussion post is done.')).toBeTruthy();
    expect(screen.getByText('How long did it take you?')).toBeTruthy();
  });

  it("sends the hours to the server as a review of the task's course, and says thanks", async () => {
    renderWeek();
    tickDone();
    await saveHours('2.5');

    expect(addReviewMock).toHaveBeenCalledWith('c1', { title: 'Discussion post', hours: 2.5 });
    expect(screen.getByTestId('hours-review-saved')).toBeTruthy();
    expect(screen.queryByTestId('hours-review-input')).toBeNull();
  });

  it('does not send blank or impossible hours, and says why', async () => {
    renderWeek();
    tickDone();
    await saveHours('');
    await saveHours('0');
    await saveHours('150');
    await saveHours('lots');

    expect(addReviewMock).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the hours it took, more than 0 and up to 100.')).toBeTruthy();
  });

  it("shows the server's message and keeps the box when saving fails", async () => {
    addReviewMock.mockRejectedValue(new Error('Could not reach the server at http://localhost:3000'));
    renderWeek();
    tickDone();
    await saveHours('2.5');

    expect(screen.getByText('Could not reach the server at http://localhost:3000')).toBeTruthy();
    expect(screen.getByTestId('hours-review-input')).toBeTruthy();
  });

  it('Skip hides the question without saving anything', () => {
    renderWeek();
    tickDone();
    fireEvent.press(screen.getByText('Skip'));

    expect(screen.queryByTestId('hours-review')).toBeNull();
    expect(addReviewMock).not.toHaveBeenCalled();
  });
});
