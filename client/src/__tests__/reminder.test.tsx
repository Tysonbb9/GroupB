import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/(tabs)/index';
import { fetchCheckinQuestion, fetchReminder, fetchSemester, Reminder } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * #156, AI screen 3: a reminder at the top of Forecast. The server decides
 * when there is one (at most 2 a day, never twice about one assignment);
 * the phone shows it, with "1 of 2 today", and opens This week from it.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  fetchCheckinQuestion: jest.fn(async () => null),
  fetchReminder: jest.fn(),
}));
const mockFetchSemester = jest.mocked(fetchSemester);
const mockFetchReminder = jest.mocked(fetchReminder);
const mockFetchCheckin = jest.mocked(fetchCheckinQuestion);

jest.setTimeout(30000);

const demo: Reminder = {
  taskId: 'proj',
  courseId: 'c1',
  code: 'CS 262',
  title: 'Big project',
  text: 'Start it this week: 20 hours, due week 6.',
  countToday: 1,
  maxPerDay: 2,
};

beforeEach(() => {
  mockPush.mockClear();
  mockFetchSemester.mockReset();
  mockFetchReminder.mockReset();
  mockFetchCheckin.mockClear();
});

/** Forecast with the semester from the (fake) server, which is when reminders are asked for. */
async function renderFromServer() {
  mockFetchSemester.mockResolvedValue(wallSemester);
  render(
    <SemesterProvider>
      <SemesterScreen />
    </SemesterProvider>
  );
  await screen.findByTestId('week-bar-1');
}

describe('a reminder on Forecast', () => {
  it('shows the course, the assignment, the one line and the count for today', async () => {
    mockFetchReminder.mockResolvedValue(demo);
    await renderFromServer();

    expect(await screen.findByTestId('reminder')).toHaveTextContent(/CS 262 · Big project/);
    expect(screen.getByText('Start it this week: 20 hours, due week 6.')).toBeTruthy();
    expect(screen.getByTestId('reminder-count')).toHaveTextContent('1 of 2 today');
  });

  it('shows the second of the day as 2 of 2', async () => {
    mockFetchReminder.mockResolvedValue({ ...demo, countToday: 2 });
    await renderFromServer();
    expect(await screen.findByTestId('reminder-count')).toHaveTextContent('2 of 2 today');
  });

  it('shows nothing when the server has no reminder', async () => {
    mockFetchReminder.mockResolvedValue(null);
    await renderFromServer();
    expect(mockFetchReminder).toHaveBeenCalled();
    expect(screen.queryByTestId('reminder')).toBeNull();
  });

  it('shows nothing, and Forecast still works, when asking fails', async () => {
    mockFetchReminder.mockRejectedValue(new Error('Could not reach the server at http://x'));
    await renderFromServer();
    expect(screen.queryByTestId('reminder')).toBeNull();
    expect(screen.getByTestId('figure-this-week')).toBeTruthy();
  });

  it('asks only once when Forecast opens, since each reminder counts toward the limit', async () => {
    mockFetchReminder.mockResolvedValue(demo);
    await renderFromServer();
    await screen.findByTestId('reminder');
    fireEvent.press(screen.getByTestId('week-bar-6'));
    expect(mockFetchReminder).toHaveBeenCalledTimes(1);
  });

  it('Open This week goes to This week and closes the card', async () => {
    mockFetchReminder.mockResolvedValue(demo);
    await renderFromServer();
    fireEvent.press(await screen.findByRole('button', { name: 'Open This week for Big project' }));
    expect(mockPush).toHaveBeenCalledWith('/week');
    expect(screen.queryByTestId('reminder')).toBeNull();
  });

  it('Dismiss closes the card and does not ask for another', async () => {
    mockFetchReminder.mockResolvedValue(demo);
    await renderFromServer();
    fireEvent.press(await screen.findByRole('button', { name: 'Dismiss the reminder' }));
    expect(screen.queryByTestId('reminder')).toBeNull();
    expect(mockFetchReminder).toHaveBeenCalledTimes(1);
  });

  it('sits above the check-in question when both are there', async () => {
    mockFetchReminder.mockResolvedValue(demo);
    mockFetchCheckin.mockResolvedValue({ courseId: 'c1', code: 'CS 262', text: 'Is CS 262 still on schedule?', reason: null });
    await renderFromServer();
    await screen.findByText('Is CS 262 still on schedule?');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Start it this week')).toBeLessThan(tree.indexOf('Is CS 262 still on schedule?'));
  });
});

describe('with sample data on the device', () => {
  it('never asks for a reminder, since there is no server to keep the limits', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(mockFetchReminder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reminder')).toBeNull();
  });
});
