import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import { fetchSemester, saveWeeklyCapacity } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// The server, for the tests that load the semester from it.
jest.mock('../lib/api', () => ({
  ...jest.requireActual('../lib/api'),
  fetchSemester: jest.fn(),
  saveWeeklyCapacity: jest.fn(),
}));
const mockFetch = fetchSemester as jest.Mock;
const mockSave = saveWeeklyCapacity as jest.Mock;

beforeEach(() => {
  mockFetch.mockReset();
  mockSave.mockReset();
});

/**
 * US-32: the student changes how many hours they have each week.
 *
 * wallSemester at week 5, with 10 hours a week: week 5 holds 10 hours (Busy),
 * week 6 holds 18 and week 7 holds 14, so week 6 is the next wall. At 20
 * hours a week nothing is over capacity and week 5 fits.
 */
const atWeek5 = { ...wallSemester, currentWeek: 5 };

/** Forecast and This week together, as on a phone, on the semester given. */
function renderScreens(initial?: typeof atWeek5) {
  return render(
    <SemesterProvider initial={initial}>
      <SemesterScreen />
      <WeekScreen />
    </SemesterProvider>
  );
}

/** Forecast and This week each have a load pill, and both must agree. */
function expectBothPills(word: string) {
  const pills = screen.getAllByTestId('load-pill');
  expect(pills).toHaveLength(2);
  pills.forEach((pill) => expect(pill).toHaveTextContent(word));
}

function changeHoursTo(text: string) {
  fireEvent.press(screen.getByTestId('capacity-change'));
  fireEvent.changeText(screen.getByTestId('capacity-input'), text);
  fireEvent.press(screen.getByTestId('capacity-save'));
}

describe('US-32: changing the hours a week', () => {
  it('says what the dashed line is, with a way to change it', () => {
    renderScreens(atWeek5);
    expect(screen.getByText('Dashed line is your 10 hours a week')).toBeTruthy();
    expect(screen.getByLabelText('Change your hours a week, now 10')).toBeTruthy();
  });

  it('opens with the current hours filled in', () => {
    renderScreens(atWeek5);
    fireEvent.press(screen.getByTestId('capacity-change'));
    expect(screen.getByTestId('capacity-input').props.value).toBe('10');
    expect(screen.getByText('Whole hours, 1 to 80.')).toBeTruthy();
  });

  it('redraws the forecast with the new hours', async () => {
    renderScreens(atWeek5);
    expectBothPills('Busy');
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/wk 6/);

    changeHoursTo('20');

    expect(await screen.findByText('Dashed line is your 20 hours a week')).toBeTruthy();
    expect(screen.queryByTestId('capacity-editor')).toBeNull();
    expectBothPills('Fits');
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/none/);
    expect(screen.getByText('Nothing over capacity ahead')).toBeTruthy();
  });

  it('shortens the crunch when a week is still over the new hours', async () => {
    renderScreens(atWeek5);
    changeHoursTo('15');

    expect(await screen.findByText('Dashed line is your 15 hours a week')).toBeTruthy();
    // Week 6 (18 hours) is still over 15, week 7 (14 hours) no longer is.
    expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/wk 6/);
    expect(screen.queryByTestId('crunch-period')).toBeNull();
  });

  it('shows the new hours on This week too', async () => {
    renderScreens(atWeek5);
    changeHoursTo('20');

    await screen.findByText('Dashed line is your 20 hours a week');
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 20 hrs/);
  });

  it.each(['0', '81', '12.5', '', 'abc'])(
    'refuses "%s", and changes nothing',
    (text) => {
      renderScreens(atWeek5);
      changeHoursTo(text);

      expect(screen.getByTestId('capacity-problem')).toHaveTextContent(
        'Enter whole hours from 1 to 80.'
      );
      expectBothPills('Busy');
      expect(screen.getByTestId('figure-next-wall')).toHaveTextContent(/wk 6/);
    }
  );

  it('changes nothing while the student is still typing', () => {
    renderScreens(atWeek5);
    fireEvent.press(screen.getByTestId('capacity-change'));
    fireEvent.changeText(screen.getByTestId('capacity-input'), '20');

    expectBothPills('Busy');
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 10 hrs/);
  });

  it('closes on Cancel, keeping the old hours', () => {
    renderScreens(atWeek5);
    fireEvent.press(screen.getByTestId('capacity-change'));
    fireEvent.changeText(screen.getByTestId('capacity-input'), '20');
    fireEvent.press(screen.getByTestId('capacity-cancel'));

    expect(screen.queryByTestId('capacity-editor')).toBeNull();
    expect(screen.getByText('Dashed line is your 10 hours a week')).toBeTruthy();
  });
});

describe('US-32: the hours are kept on the server', () => {
  beforeEach(() => mockFetch.mockResolvedValue(atWeek5));

  it('saves them on the server, then redraws', async () => {
    mockSave.mockResolvedValue(20);
    renderScreens();
    await screen.findByTestId('capacity-change');

    changeHoursTo('20');

    expect(await screen.findByText('Dashed line is your 20 hours a week')).toBeTruthy();
    expect(mockSave).toHaveBeenCalledWith(20);
    expectBothPills('Fits');
  });

  it('keeps the old hours, and says so, when the save fails', async () => {
    mockSave.mockRejectedValue(new Error('Could not reach the server at http://localhost:3000'));
    renderScreens();
    await screen.findByTestId('capacity-change');

    changeHoursTo('20');

    expect(await screen.findByText('Could not save. Your hours are still 10.')).toBeTruthy();
    expect(screen.getByTestId('capacity-input').props.value).toBe('20');
    expectBothPills('Busy');
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 10 hrs/);
  });

  it('does not save the same hours again', async () => {
    renderScreens();
    await screen.findByTestId('capacity-change');

    changeHoursTo('10');

    await waitFor(() => expect(screen.queryByTestId('capacity-editor')).toBeNull());
    expect(mockSave).not.toHaveBeenCalled();
  });
});
