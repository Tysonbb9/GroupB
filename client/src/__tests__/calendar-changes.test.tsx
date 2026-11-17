import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import CalendarScreen from '../app/calendar';
import {
  CalendarChange,
  fetchCalendarChanges,
  fetchCalendarEvents,
  fetchSemester,
  settleCalendarChanges,
} from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * US-50 (#166): deadlines that changed in Moodle are shown, and nothing
 * changes until the student accepts. wallSemester: "Midterm" (exam) is due
 * week 6 and "Paper" week 7; the current week is 3.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  fetchCheckinQuestion: jest.fn(async () => null),
  fetchReminder: jest.fn(async () => null),
  fetchCalendarChanges: jest.fn(),
  settleCalendarChanges: jest.fn(),
  fetchCalendarEvents: jest.fn(),
  addCalendarEvents: jest.fn(),
  addReview: jest.fn(),
}));
const mockChanges = jest.mocked(fetchCalendarChanges);
const mockSettle = jest.mocked(settleCalendarChanges);
const mockEvents = jest.mocked(fetchCalendarEvents);
const mockSemester = jest.mocked(fetchSemester);

jest.setTimeout(30000);

const moved: CalendarChange = { kind: 'moved', eventId: 'e1', taskId: 'exam', title: 'Midterm', fromWeek: 6, toWeek: 8 };
const removed: CalendarChange = { kind: 'removed', eventId: 'e2', taskId: 'paper', title: 'Paper', week: 7 };

beforeEach(() => {
  mockPush.mockClear();
  mockChanges.mockReset();
  mockSettle.mockReset();
  mockEvents.mockReset();
  mockSemester.mockReset();
  mockEvents.mockResolvedValue({ proposals: [], alreadyAdded: 0, outsideSemester: 0 });
});

/** The review screen, with This week beside it to see the tasks follow. */
async function renderReview(changes: CalendarChange[]) {
  mockChanges.mockResolvedValue({ changes, newEvents: 0 });
  render(
    <SemesterProvider initial={wallSemester}>
      <CalendarScreen />
      <WeekScreen />
    </SemesterProvider>
  );
  await act(async () => {});
}

describe('the changes on the review screen', () => {
  it('says what moved and what was removed, in plain words', async () => {
    await renderReview([moved, removed]);
    expect(screen.getByTestId('calendar-change-e1')).toHaveTextContent(/Midterm moved from week 6 to week 8\./);
    expect(screen.getByTestId('calendar-change-e2')).toHaveTextContent(/Paper \(week 7\) is no longer in your Moodle calendar\./);
  });

  it('accepting a move sends it, and the task follows to the new week', async () => {
    mockSettle.mockResolvedValue({ tasks: [{ ...wallSemester.tasks[1], dueWeek: 8 }], removedTaskIds: [] });
    await renderReview([moved]);
    fireEvent.press(screen.getByRole('button', { name: 'Move Midterm to week 8' }));
    await act(async () => {});

    expect(mockSettle).toHaveBeenCalledWith({ accept: ['e1'], keep: [] });
    expect(screen.queryByTestId('calendar-change-e1')).toBeNull();
  });

  it('accepting a removal sends it, and the task leaves the semester', async () => {
    mockSettle.mockResolvedValue({ tasks: [], removedTaskIds: ['post'] });
    await renderReview([{ kind: 'removed', eventId: 'e3', taskId: 'post', title: 'Discussion post', week: 3 }]);
    expect(screen.getByTestId('row-post')).toBeTruthy(); // on This week until accepted
    fireEvent.press(screen.getByRole('button', { name: 'Remove Discussion post' }));
    await act(async () => {});

    expect(mockSettle).toHaveBeenCalledWith({ accept: ['e3'], keep: [] });
    expect(screen.queryByTestId('row-post')).toBeNull();
  });

  it('Keep mine sends it as kept, and changes no task', async () => {
    mockSettle.mockResolvedValue({ tasks: [], removedTaskIds: [] });
    await renderReview([moved]);
    fireEvent.press(screen.getByRole('button', { name: 'Keep Midterm as it is' }));
    await act(async () => {});
    expect(mockSettle).toHaveBeenCalledWith({ accept: [], keep: ['e1'] });
    expect(screen.queryByTestId('calendar-change-e1')).toBeNull();
  });

  it('Accept all sends every change shown', async () => {
    mockSettle.mockResolvedValue({ tasks: [], removedTaskIds: [] });
    await renderReview([moved, removed]);
    fireEvent.press(screen.getByTestId('calendar-accept-all'));
    await act(async () => {});
    expect(mockSettle).toHaveBeenCalledWith({ accept: ['e1', 'e2'], keep: [] });
    expect(screen.queryByTestId('calendar-changes')).toBeNull();
  });

  it('offers Accept all only when there is more than one', async () => {
    await renderReview([moved]);
    expect(screen.queryByTestId('calendar-accept-all')).toBeNull();
  });

  it('keeps the change, and says why, when saving fails', async () => {
    mockSettle.mockRejectedValue(new Error('Moodle could not be reached. Try again in a moment.'));
    await renderReview([moved]);
    fireEvent.press(screen.getByRole('button', { name: 'Move Midterm to week 8' }));
    await act(async () => {});
    expect(screen.getByTestId('calendar-changes-problem')).toHaveTextContent(
      'Could not save, so nothing has changed. Moodle could not be reached. Try again in a moment.'
    );
    expect(screen.getByTestId('calendar-change-e1')).toBeTruthy();
  });

  it('does not say "nothing new" while changes are waiting', async () => {
    await renderReview([moved]);
    expect(screen.queryByTestId('calendar-nothing-new')).toBeNull();
  });
});

describe('the background check on Forecast', () => {
  async function renderForecast() {
    mockSemester.mockResolvedValue(wallSemester);
    render(
      <SemesterProvider>
        <SemesterScreen />
      </SemesterProvider>
    );
    await screen.findByTestId('week-bar-1');
    await act(async () => {});
  }

  it('shows a row when something changed or is new, opening the review', async () => {
    mockChanges.mockResolvedValue({ changes: [moved, removed], newEvents: 1 });
    await renderForecast();
    expect(screen.getByTestId('calendar-row')).toHaveTextContent(/Moodle calendar/);
    expect(screen.getByTestId('calendar-row')).toHaveTextContent(/2 changes and 1 new event to review/);
    fireEvent.press(screen.getByTestId('calendar-row'));
    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  it('says "1 change" for one', async () => {
    mockChanges.mockResolvedValue({ changes: [moved], newEvents: 0 });
    await renderForecast();
    expect(screen.getByTestId('calendar-row')).toHaveTextContent(/1 change to review/);
  });

  it('shows nothing when the calendar has nothing new', async () => {
    mockChanges.mockResolvedValue({ changes: [], newEvents: 0 });
    await renderForecast();
    expect(screen.queryByTestId('calendar-row')).toBeNull();
  });

  it('shows nothing when no link is saved', async () => {
    mockChanges.mockResolvedValue(null);
    await renderForecast();
    expect(screen.queryByTestId('calendar-row')).toBeNull();
  });

  it('says in plain words when the link stopped working, and points to Courses', async () => {
    mockChanges.mockRejectedValue(new Error('Moodle did not accept that link. Copy a new calendar link from Moodle.'));
    await renderForecast();
    expect(screen.getByTestId('calendar-row')).toHaveTextContent(/Moodle calendar link stopped working/);
    expect(screen.getByTestId('calendar-row')).toHaveTextContent(/Copy a new calendar link from Moodle/);
    fireEvent.press(screen.getByTestId('calendar-row'));
    expect(mockPush).toHaveBeenCalledWith('/courses');
  });

  it('does not hold up the screen while it checks', async () => {
    mockChanges.mockReturnValue(new Promise(() => {}));
    await renderForecast();
    expect(screen.getByTestId('figure-this-week')).toBeTruthy();
    expect(screen.queryByTestId('calendar-row')).toBeNull();
  });

  it('never checks with sample data on the device', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(mockChanges).not.toHaveBeenCalled();
  });
});
