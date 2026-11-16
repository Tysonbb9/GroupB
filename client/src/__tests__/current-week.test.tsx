import { render, screen, within } from '@testing-library/react-native';
import React from 'react';
import CoursesScreen from '../app/(tabs)/courses';
import SemesterScreen from '../app/(tabs)/index';
import WeekScreen from '../app/(tabs)/week';
import { WeekChip } from '../components/WeekChip';
import { WeekStrip } from '../components/WeekStrip';
import { weeklyLoad } from '../lib/workload';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';
import { theme } from '../theme';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * US-46 (#161): a student sees at a glance which week of the semester they
 * are in. Professor Norman missed the old small grey line above the title, so
 * the week is a chip under the title on every tab, and the week strip says
 * "Now" under this week instead of only colouring it.
 */

function renderTab(tab: React.ReactElement, semester = wallSemester) {
  return render(<SemesterProvider initial={semester}>{tab}</SemesterProvider>);
}

// The chip's text content starts with its calendar icon's glyph, so the
// checks match the end of it.
describe('the week chip', () => {
  it('says the week and the length of the semester', () => {
    render(<WeekChip week={5} />);
    expect(screen.getByTestId('week-chip')).toHaveTextContent(/Week 5 of 15$/);
  });

  it('tells a screen reader it is the week of the semester', () => {
    render(<WeekChip week={5} />);
    expect(screen.getByLabelText('Week 5 of 15 of the semester')).toBeTruthy();
  });

  it('is drawn in the accent colour, which is readable on its background', () => {
    render(<WeekChip week={1} />);
    expect(screen.getByText('Week 1 of 15')).toHaveStyle({ color: theme.accent });
    expect(screen.getByTestId('week-chip')).toHaveStyle({ backgroundColor: theme.accentSoft });
  });

  it.each([1, 15])('shows the first and the last week (%i)', (week) => {
    render(<WeekChip week={week} />);
    expect(screen.getByTestId('week-chip')).toHaveTextContent(new RegExp(`Week ${week} of 15$`));
  });
});

describe.each([
  ['Forecast', <SemesterScreen key="forecast" />],
  ['This week', <WeekScreen key="week" />],
  ['Courses', <CoursesScreen key="courses" />],
])('the %s tab', (title, tab) => {
  it('shows the current week as a chip at the top', () => {
    renderTab(tab);
    expect(screen.getByTestId('week-chip')).toHaveTextContent(/Week 3 of 15$/);
  });

  it('follows the semester, not a fixed number', () => {
    renderTab(tab, { ...wallSemester, currentWeek: 9 });
    expect(screen.getByTestId('week-chip')).toHaveTextContent(/Week 9 of 15$/);
  });

  it('keeps the semester name above the title', () => {
    renderTab(tab);
    expect(screen.getByText(new RegExp(wallSemester.label))).toBeTruthy();
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
  });
});

describe('the old small line is gone', () => {
  it('Forecast no longer writes the week in the line above the title', () => {
    renderTab(<SemesterScreen />);
    expect(screen.queryByText(/· Week 3 of 15/)).toBeNull();
    expect(screen.getAllByText(/Week 3 of 15/)).toHaveLength(1);
  });

  it('This week says the week once, in the chip', () => {
    renderTab(<WeekScreen />);
    expect(screen.getAllByText(/Week 3 of 15/)).toHaveLength(1);
  });
});

describe('the week strip labels this week', () => {
  const loads = weeklyLoad(wallSemester.tasks);

  function renderStrip(currentWeek: number) {
    return render(
      <WeekStrip
        loads={loads}
        capacity={wallSemester.weeklyCapacity}
        currentWeek={currentWeek}
        selectedWeek={currentWeek}
        wallWeek={null}
        onSelectWeek={jest.fn()}
      />
    );
  }

  it('writes "Now" under the current week', () => {
    renderStrip(3);
    expect(screen.getAllByTestId('week-now')).toHaveLength(1);
    expect(screen.getByTestId('week-now')).toHaveTextContent('Now');
  });

  it('puts "Now" in the same column as the current week number', () => {
    renderStrip(7);
    const column = screen.getByTestId('week-axis-7').parent?.parent;
    expect(column).toBeTruthy();
    expect(within(column!).getByTestId('week-now')).toBeTruthy();
    const otherColumn = screen.getByTestId('week-axis-6').parent?.parent;
    expect(within(otherColumn!).queryByTestId('week-now')).toBeNull();
  });

  it('still colours the current week number', () => {
    renderStrip(3);
    expect(screen.getByTestId('week-axis-3')).toHaveStyle({ color: theme.accent });
  });

  it('moves with the semester', () => {
    renderStrip(15);
    const column = screen.getByTestId('week-axis-15').parent?.parent;
    expect(within(column!).getByTestId('week-now')).toBeTruthy();
  });

  it('keeps every week number on the axis', () => {
    renderStrip(3);
    for (let week = 1; week <= 15; week++) {
      expect(screen.getByTestId(`week-axis-${week}`)).toHaveTextContent(String(week));
    }
  });

  it('shows "Now" on the Forecast tab', () => {
    renderTab(<SemesterScreen />);
    expect(screen.getByTestId('week-now')).toHaveTextContent('Now');
  });
});
