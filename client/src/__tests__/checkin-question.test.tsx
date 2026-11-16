import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/(tabs)/index';
import { answerCheckin, fetchCheckinQuestion, fetchSemester } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// No server in these tests: the three calls the Forecast tab makes are fakes.
jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  fetchCheckinQuestion: jest.fn(),
  answerCheckin: jest.fn(),
}));
const mockFetchSemester = jest.mocked(fetchSemester);
const mockFetchQuestion = jest.mocked(fetchCheckinQuestion);
const mockAnswer = jest.mocked(answerCheckin);

jest.setTimeout(30000);

const question = {
  courseId: 'c1',
  code: 'CS 262',
  text: 'Is CS 262 still on schedule?',
  reason: 'The team board moved the project.',
};

beforeEach(() => {
  mockFetchSemester.mockReset().mockResolvedValue(wallSemester);
  mockFetchQuestion.mockReset().mockResolvedValue(question);
  mockAnswer.mockReset().mockResolvedValue([]);
});

/** The Forecast tab with its semester from the (fake) server. */
async function renderForecast() {
  render(
    <SemesterProvider>
      <SemesterScreen />
    </SemesterProvider>
  );
  await screen.findByTestId('figure-this-week');
}

describe('#155: the check-in question on the Forecast tab', () => {
  it('shows the question the server chose, with its reason, above the figures', async () => {
    await renderForecast();

    expect(await screen.findByText('Is CS 262 still on schedule?')).toBeTruthy();
    expect(screen.getByText('The team board moved the project.')).toBeTruthy();
    expect(screen.getByTestId('checkin-yes')).toBeTruthy();
    expect(screen.getByTestId('checkin-changed')).toBeTruthy();
  });

  it('shows no card when the server has nothing to ask (no key)', async () => {
    mockFetchQuestion.mockResolvedValue(null);
    await renderForecast();
    await act(async () => {});

    expect(screen.queryByTestId('checkin-card')).toBeNull();
  });

  it('"Yes, still accurate" saves the answer and hides the card', async () => {
    await renderForecast();
    await screen.findByTestId('checkin-card');

    await act(async () => {
      fireEvent.press(screen.getByTestId('checkin-yes'));
    });

    expect(mockAnswer).toHaveBeenCalledWith('c1', 'on-schedule', undefined);
    expect(screen.queryByTestId('checkin-card')).toBeNull();
  });

  it('"Something changed" opens boxes for the course\'s open tasks, not a text box', async () => {
    await renderForecast();
    await screen.findByTestId('checkin-card');
    fireEvent.press(screen.getByTestId('checkin-changed'));

    // CS 262's open tasks from this week on. Not MATH 251's Midterm.
    expect(screen.getByTestId('checkin-week-proj')).toHaveDisplayValue('6');
    expect(screen.getByTestId('checkin-hours-proj')).toHaveDisplayValue('20');
    expect(screen.getByTestId('checkin-week-paper')).toBeTruthy();
    expect(screen.getByTestId('checkin-hours-post')).toHaveDisplayValue('');
    expect(screen.queryByTestId('checkin-week-exam')).toBeNull();
  });

  it('Save sends only what changed, and the forecast recomputes from it', async () => {
    const savedPost = { ...wallSemester.tasks[3], estimatedHours: 4 };
    mockAnswer.mockResolvedValue([savedPost]);
    await renderForecast();
    await screen.findByTestId('checkin-card');
    expect(screen.getByTestId('figure-this-week')).toHaveTextContent(/0 \/ 10 hrs/);

    fireEvent.press(screen.getByTestId('checkin-changed'));
    fireEvent.changeText(screen.getByTestId('checkin-hours-post'), '4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('checkin-save'));
    });

    expect(mockAnswer).toHaveBeenCalledWith('c1', 'changed', [{ taskId: 'post', dueWeek: 3, estimatedHours: 4 }]);
    expect(screen.queryByTestId('checkin-card')).toBeNull();
    expect(screen.getByTestId('figure-this-week')).toHaveTextContent(/4 \/ 10 hrs/);
  });

  it('refuses a week outside 1 to 15 before sending anything', async () => {
    await renderForecast();
    await screen.findByTestId('checkin-card');
    fireEvent.press(screen.getByTestId('checkin-changed'));
    fireEvent.changeText(screen.getByTestId('checkin-week-proj'), '16');
    fireEvent.press(screen.getByTestId('checkin-save'));

    expect(screen.getByTestId('checkin-error')).toHaveTextContent(/week must be a whole number from 1 to 15/);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it('"None of these" saves that answer and hides the card', async () => {
    await renderForecast();
    await screen.findByTestId('checkin-card');
    fireEvent.press(screen.getByTestId('checkin-changed'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('checkin-none'));
    });

    expect(mockAnswer).toHaveBeenCalledWith('c1', 'none-of-these', undefined);
    expect(screen.queryByTestId('checkin-card')).toBeNull();
  });

  it('keeps the card and says why when the server refuses', async () => {
    mockAnswer.mockRejectedValue(new Error('Could not reach the server at http://x:3000'));
    await renderForecast();
    await screen.findByTestId('checkin-card');
    await act(async () => {
      fireEvent.press(screen.getByTestId('checkin-yes'));
    });

    expect(screen.getByTestId('checkin-error')).toHaveTextContent('Could not reach the server at http://x:3000');
    expect(screen.getByTestId('checkin-card')).toBeTruthy();
  });
});
