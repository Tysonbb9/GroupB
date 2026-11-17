import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CoursesScreen from '../app/(tabs)/courses';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import { fetchSemester, saveWeekHours } from '../lib/api';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';
import { theme } from '../theme';

/**
 * #148, the follow-up to US-32: the student sets different hours for one
 * week. Tapping a week's bar on Forecast shows that week's hours under its
 * assignments, with Change. The forecast, the crunch and the notices then
 * use that week's own hours, and "Use my weekly hours" clears them.
 *
 * wallSemester: 10 hours a week, week 3 now; week 5 has 10h, week 6 18h (the
 * wall), week 7 14h.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../lib/api', () => ({
  // US-50: Forecast also checks the Moodle calendar; no link here.
  fetchCalendarChanges: jest.fn(async () => null),
  // Forecast may also ask for a reminder (#156); none here.
  fetchReminder: jest.fn(async () => null),
  fetchSemester: jest.fn(),
  fetchCheckinQuestion: jest.fn(async () => null),
  saveWeekHours: jest.fn(),
}));
const mockFetchSemester = jest.mocked(fetchSemester);
const mockSaveWeekHours = jest.mocked(saveWeekHours);

jest.setTimeout(30000);

beforeEach(() => {
  mockFetchSemester.mockReset();
  mockSaveWeekHours.mockReset();
});

function renderForecast(semester: Semester = wallSemester) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
    </SemesterProvider>
  );
}

async function renderForecastFromServer(semester: Semester = wallSemester) {
  mockFetchSemester.mockResolvedValue(semester);
  render(
    <SemesterProvider>
      <SemesterScreen />
    </SemesterProvider>
  );
  await screen.findByTestId('week-bar-1');
}

const openWeek = (week: number) => fireEvent.press(screen.getByTestId(`week-bar-${week}`));
/** Types hours for the open week and saves them, then lets the save finish. */
const changeTo = async (text: string) => {
  fireEvent.press(screen.getByTestId('own-week-hours-change'));
  fireEvent.changeText(screen.getByTestId('own-week-hours-input'), text);
  fireEvent.press(screen.getByTestId('own-week-hours-save'));
  await act(async () => {});
};
const lineBottom = (week: number) =>
  (screen.getByTestId(`capacity-line-${week}`).props.style as object[]).reduce<{ bottom?: number }>(
    (all, part) => ({ ...all, ...part }),
    {}
  ).bottom;

describe("a tapped week shows that week's hours", () => {
  it('says the week uses the weekly number until it has its own', () => {
    renderForecast();
    openWeek(6);
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/You set aside 10 hours in week 6, your weekly number/);
    expect(screen.queryByTestId('own-week-hours-clear')).toBeNull();
  });

  it('says when the week has its own hours, with a way back to the weekly number', () => {
    renderForecast({ ...wallSemester, weekHours: [{ week: 6, hours: 25 }] });
    openWeek(6);
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/You set aside 25 hours in week 6, set for this week only/);
    expect(screen.getByTestId('own-week-hours-clear')).toHaveTextContent(/Use my weekly hours/);
  });

  it('starts the box at the hours the week has now', () => {
    renderForecast();
    openWeek(6);
    fireEvent.press(screen.getByTestId('own-week-hours-change'));
    expect(screen.getByTestId('own-week-hours-input').props.value).toBe('10');
  });
});

describe('setting one week its own hours', () => {
  it('moves the wall when the week now fits', async () => {
    renderForecast();
    expect(screen.getByLabelText('Next heavy week: week 6')).toBeTruthy();

    openWeek(6);
    await changeTo('20');

    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/You set aside 20 hours in week 6, set for this week only/);
    expect(screen.getByLabelText('Next heavy week: week 7')).toBeTruthy();
  });

  it('changes that week only, not the weekly number', async () => {
    renderForecast();
    openWeek(6);
    await changeTo('20');
    expect(screen.getByText('Dashed line is your 10 hours a week')).toBeTruthy();
    openWeek(6); // close it
    openWeek(5);
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/You set aside 10 hours in week 5, your weekly number/);
  });

  it('steps the dashed line at that week', async () => {
    renderForecast();
    const before = lineBottom(6);
    expect(lineBottom(5)).toBe(before);

    openWeek(6);
    await changeTo('25');

    expect(lineBottom(6)).toBeGreaterThan(lineBottom(5)!);
    expect(lineBottom(5)).toBe(lineBottom(7));
  });

  it("colours the week's bar against its own hours", async () => {
    renderForecast();
    expect(screen.getByTestId('week-bar-6')).toHaveStyle({ backgroundColor: theme.heavy });
    openWeek(6);
    await changeTo('40');
    expect(screen.getByTestId('week-bar-6')).not.toHaveStyle({ backgroundColor: theme.heavy });
  });

  it("tells a screen reader the week's own hours on its bar", async () => {
    renderForecast();
    openWeek(6);
    await changeTo('25');
    expect(screen.getByLabelText('Week 6, 18 hours, you set aside 25 that week')).toBeTruthy();
    expect(screen.getByLabelText('Week 5, 10 hours')).toBeTruthy();
  });

  it('can make a week the wall by giving it fewer hours', async () => {
    renderForecast();
    openWeek(5);
    await changeTo('8');
    expect(screen.getByLabelText('Next heavy week: week 5')).toBeTruthy();
  });

  it("uses this week's own hours in the figures and the pill", async () => {
    // Week 3 has 0 hours of work in the fixture, so give it some first.
    renderForecast({ ...wallSemester, currentWeek: 5 });
    expect(screen.getByLabelText('This week: busy, 10 of your 10 allocated hours')).toBeTruthy();
    expect(screen.getByLabelText('This week: busy')).toBeTruthy();

    openWeek(5);
    await changeTo('8');

    expect(screen.getByLabelText('This week: heavy, 10 of your 8 allocated hours')).toBeTruthy();
    expect(screen.getByLabelText('This week: heavy')).toBeTruthy();
  });

  it.each(['0', '81', '2.5', 'abc', ''])('refuses %p and changes nothing', async (text) => {
    renderForecast();
    openWeek(6);
    await changeTo(text);
    expect(screen.getByTestId('own-week-hours-problem')).toHaveTextContent(/Enter whole hours from 1 to 80\./);
    expect(screen.getByLabelText('Next heavy week: week 6')).toBeTruthy();
  });

  it('typing the weekly number leaves the week without hours of its own', async () => {
    renderForecast({ ...wallSemester, weekHours: [{ week: 6, hours: 25 }] });
    openWeek(6);
    await changeTo('10');
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/your weekly number/);
  });

  it('Cancel changes nothing', () => {
    renderForecast();
    openWeek(6);
    fireEvent.press(screen.getByTestId('own-week-hours-change'));
    fireEvent.changeText(screen.getByTestId('own-week-hours-input'), '30');
    fireEvent.press(screen.getByTestId('own-week-hours-cancel'));
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/You set aside 10 hours in week 6/);
  });
});

describe('going back to the weekly number', () => {
  it('Use my weekly hours clears the week, and the wall comes back', async () => {
    renderForecast({ ...wallSemester, weekHours: [{ week: 6, hours: 25 }] });
    expect(screen.getByLabelText('Next heavy week: week 7')).toBeTruthy();
    openWeek(6);
    fireEvent.press(screen.getByTestId('own-week-hours-clear'));
    await act(async () => {});
    expect(screen.getByTestId('own-week-hours')).toHaveTextContent(/your weekly number/);
    expect(screen.getByLabelText('Next heavy week: week 6')).toBeTruthy();
  });
});

describe('saving on the server', () => {
  it('saves with PATCH /semester/weeks/:week, then uses what the server kept', async () => {
    mockSaveWeekHours.mockResolvedValue([{ week: 6, hours: 20 }]);
    await renderForecastFromServer();
    openWeek(6);
    await changeTo('20');

    expect(await screen.findByText(/set for this week only/)).toBeTruthy();
    expect(mockSaveWeekHours).toHaveBeenCalledWith(6, 20);
    expect(screen.getByLabelText('Next heavy week: week 7')).toBeTruthy();
  });

  it('sends null to go back to the weekly number', async () => {
    mockSaveWeekHours.mockResolvedValue([]);
    await renderForecastFromServer({ ...wallSemester, weekHours: [{ week: 6, hours: 25 }] });
    openWeek(6);
    fireEvent.press(screen.getByTestId('own-week-hours-clear'));

    expect(await screen.findByText(/your weekly number/)).toBeTruthy();
    expect(mockSaveWeekHours).toHaveBeenCalledWith(6, null);
  });

  it('keeps the old hours, and says so, when saving fails', async () => {
    mockSaveWeekHours.mockRejectedValue(new Error('Could not reach the server at http://x'));
    await renderForecastFromServer();
    openWeek(6);
    await changeTo('20');

    expect(await screen.findByTestId('own-week-hours-problem')).toHaveTextContent(
      'Could not save. Week 6 still has 10 hours.'
    );
    expect(screen.getByLabelText('Next heavy week: week 6')).toBeTruthy();
  });

  it('does not call the server when nothing would change', async () => {
    await renderForecastFromServer();
    openWeek(6);
    await changeTo('10');
    expect(mockSaveWeekHours).not.toHaveBeenCalled();
  });

  it("uses the weeks the server sent with the semester", async () => {
    await renderForecastFromServer({ ...wallSemester, weekHours: [{ week: 6, hours: 20 }] });
    expect(screen.getByLabelText('Next heavy week: week 7')).toBeTruthy();
  });
});

describe('the other tabs use each week its own hours', () => {
  it("This week's figure and pill use this week's own hours", () => {
    render(
      <SemesterProvider initial={{ ...wallSemester, weekHours: [{ week: 3, hours: 6 }] }}>
        <WeekScreen />
      </SemesterProvider>
    );
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 6 hrs/);
  });

  it("the notices on Courses measure a week against that week's hours", () => {
    render(
      <SemesterProvider initial={{ ...wallSemester, weekHours: [{ week: 6, hours: 20 }] }}>
        <CoursesScreen />
      </SemesterProvider>
    );
    expect(screen.getAllByLabelText(/busiest week, week 6, \d+ of your 20 allocated hours$/).length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/busiest week, week 6, \d+ of your 10 allocated hours$/)).toHaveLength(0);
  });
});
