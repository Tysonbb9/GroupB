import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CoursesScreen from '../app/(tabs)/courses';
import SemesterScreen from '../app/(tabs)/index';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

function renderForecast() {
  return render(
    <SemesterProvider initial={wallSemester}>
      <SemesterScreen />
    </SemesterProvider>
  );
}

/**
 * Option A (#96): Forecast keeps one focus. This week's hours, the strip and
 * the one action stay; the rest is one tap away on the Courses tab.
 */
describe('Forecast: one focus', () => {
  it('keeps the hours, the strip and the one action', () => {
    renderForecast();
    expect(screen.getByTestId('figure-this-week')).toBeTruthy();
    expect(screen.getByTestId('week-bar-1')).toBeTruthy();
    expect(screen.getByTestId('crunch-summary')).toBeTruthy();
  });

  it('leaves the notices, the course summary, the chips and the reminder to Courses', () => {
    renderForecast();
    expect(screen.queryByTestId('spike-notices')).toBeNull();
    expect(screen.queryByTestId('difficulty-summary')).toBeNull();
    expect(screen.queryByTestId('courses')).toBeNull();
    expect(screen.queryByTestId('syllabus-reminder')).toBeNull();
  });

  it('has no Coming up grid or See this week button, which the tabs replace', () => {
    renderForecast();
    expect(screen.queryByTestId('coming-up')).toBeNull();
    expect(screen.queryByTestId('go-to-week')).toBeNull();
  });
});

describe('Forecast: rows that open Courses', () => {
  // wallSemester, week 3 of 15, capacity 10: CS 262 spikes in weeks 5 to 7 and
  // MATH 251 in week 6, so weeks 5 and 6 hold three notices.
  it('counts the heads-up notices in the next three weeks', () => {
    renderForecast();
    expect(screen.getByTestId('heads-up-row')).toHaveTextContent(/3 notices in the next 3 weeks/);
  });

  it('says how many courses have heavy weeks', () => {
    renderForecast();
    expect(screen.getByTestId('course-spikes-row')).toHaveTextContent(/2 of 2 courses have heavy weeks/);
  });

  it('says so when nothing is coming up', () => {
    render(
      <SemesterProvider initial={{ ...wallSemester, tasks: [] }}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(screen.getByTestId('heads-up-row')).toHaveTextContent(/Nothing in the next 3 weeks/);
  });

  it('opens the Courses tab from either row', () => {
    renderForecast();
    fireEvent.press(screen.getByTestId('heads-up-row'));
    fireEvent.press(screen.getByTestId('course-spikes-row'));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/courses');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/courses');
  });
});

describe('Courses: what used to crowd Forecast', () => {
  it('shows the notices, the course summary, the chips and the reminder', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <CoursesScreen />
      </SemesterProvider>
    );
    expect(screen.getByTestId('spike-notices')).toBeTruthy();
    expect(screen.getByTestId('difficulty-summary')).toBeTruthy();
    expect(screen.getByTestId('courses')).toBeTruthy();
    expect(screen.getByTestId('syllabus-reminder')).toBeTruthy();
  });
});
