import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import CoursesScreen from '../app/(tabs)/courses';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import TaskDetailScreen from '../app/task/[id]';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * End to end on the phone: Forecast, This week, Courses and an assignment's
 * details, all on one semester, the way the app runs them. A change made on
 * one screen has to show on every other (US-10, US-11, US-39), with no
 * refresh (US-35). Sample data on the device, so no server is needed.
 *
 * wallSemester: 10 hours a week, week 3 now. Week 5 has 10h (Big project),
 * week 6 18h (Big project 10 + Midterm 8, the wall), week 7 14h (Paper).
 */

let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../lib/api', () => ({ addReview: jest.fn(async () => ({ id: 'r1' })) }));

jest.setTimeout(30000);

function renderApp(openTask = 'exam') {
  mockParams = { id: openTask };
  return render(
    <SemesterProvider initial={wallSemester}>
      <SemesterScreen />
      <WeekScreen />
      <CoursesScreen />
      <TaskDetailScreen />
    </SemesterProvider>
  );
}

const nextWall = () => screen.getByTestId('figure-next-wall');

describe('one semester behind every screen', () => {
  it('starts with every screen telling the same story', () => {
    renderApp();
    expect(nextWall()).toHaveTextContent(/wk 6/);
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    expect(screen.getAllByTestId('week-chip')).toHaveLength(3); // Forecast, This week, Courses
    for (const chip of screen.getAllByTestId('week-chip')) expect(chip).toHaveTextContent(/Week 3 of 15$/);
    expect(screen.getByLabelText('Due: Week 6')).toBeTruthy(); // the Midterm's details
  });

  it('moving the Midterm on its details moves it on the Forecast and lifts the wall', async () => {
    renderApp('exam');
    fireEvent.changeText(screen.getByTestId('task-week-input'), '9');
    fireEvent.press(screen.getByTestId('task-save'));
    await act(async () => {});

    expect(screen.getByLabelText('Due: Week 9')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 10 hours')).toBeTruthy();
    expect(screen.getByLabelText('Week 9, 8 hours')).toBeTruthy();
    // Week 6 now fits (10 of 10); the Paper in week 7 is the next wall.
    expect(nextWall()).toHaveTextContent(/wk 7/);
  });

  it('more weekly hours on the Forecast reach This week and the notices on Courses', async () => {
    renderApp();
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 10 hrs/);
    const noticesBefore = screen.queryAllByTestId(/^spike-notice-/).length;
    expect(noticesBefore).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId('capacity-change'));
    fireEvent.changeText(screen.getByTestId('capacity-input'), '40');
    fireEvent.press(screen.getByTestId('capacity-save'));
    await act(async () => {});

    expect(screen.getByTestId('week-hours')).toHaveTextContent(/\/ 40 hrs/); // This week
    expect(nextWall()).toHaveTextContent(/none/); // Forecast
    // With 40 hours, 30% is 12, so no course's week is a spike any more.
    expect(screen.queryAllByTestId(/^spike-notice-/)).toHaveLength(0); // Courses
  });

  it('finishing the Midterm on This week takes its hours off the Forecast and Courses at once', async () => {
    // In week 5, the Midterm (8h, due week 6) is on This week under Next week.
    mockParams = { id: 'exam' };
    render(
      <SemesterProvider initial={{ ...wallSemester, currentWeek: 5 }}>
        <SemesterScreen />
        <WeekScreen />
        <CoursesScreen />
        <TaskDetailScreen />
      </SemesterProvider>
    );
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    const midtermNotice = () => screen.queryAllByLabelText(/^MATH 251 busiest week, week 6,/);
    expect(midtermNotice()).toHaveLength(1);

    fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Midterm done' }));
    await act(async () => {});

    expect(screen.getByLabelText('Week 6, 10 hours')).toBeTruthy(); // Forecast
    expect(midtermNotice()).toHaveLength(0); // Courses: MATH 251 has nothing left in week 6
    expect(screen.getByLabelText('Status: Done')).toBeTruthy(); // its details
  });

  it("one week's own hours on the Forecast change that week everywhere, and only that week", async () => {
    renderApp();
    fireEvent.press(screen.getByTestId('week-bar-6'));
    fireEvent.press(screen.getByTestId('own-week-hours-change'));
    fireEvent.changeText(screen.getByTestId('own-week-hours-input'), '20');
    fireEvent.press(screen.getByTestId('own-week-hours-save'));
    await act(async () => {});

    expect(nextWall()).toHaveTextContent(/wk 7/);
    expect(screen.getByText('Dashed line is your 10 hours a week')).toBeTruthy();
    // The notices on Courses measure week 6 against its own 20 hours.
    const week6 = screen.queryAllByLabelText(/busiest week, week 6, \d+ of your 20 allocated hours$/);
    const week5 = screen.queryAllByLabelText(/busiest week, week 5, \d+ of your 10 allocated hours$/);
    expect(week6.length + week5.length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/busiest week, week 6, \d+ of your 10 allocated hours$/)).toHaveLength(0);
  });

  it('a first estimate on This week puts the work on the Forecast and in its details', async () => {
    renderApp('post');
    expect(screen.getByLabelText('Hours: Not set yet')).toBeTruthy();
    expect(screen.getByLabelText('Week 3, 0 hours')).toBeTruthy();

    const row = within(screen.getByTestId('row-post'));
    fireEvent.press(row.getByRole('button', { name: 'Add estimate for Discussion post' }));
    fireEvent.changeText(screen.getByTestId('estimate-input-post'), '2');
    fireEvent.press(screen.getByTestId('estimate-save-post'));
    await act(async () => {});

    expect(screen.getByLabelText('Week 3, 2 hours')).toBeTruthy(); // Forecast
    expect(screen.getByLabelText('Hours: 2 hours')).toBeTruthy(); // details
    expect(screen.getByTestId('week-hours')).toHaveTextContent(/^.*2.*\/ 10 hrs/); // This week
  });
});
