import { render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function renderSemester(semester: Semester = wallSemester) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
    </SemesterProvider>
  );
}

describe('US-15: a suggested week for starting a larger assignment', () => {
  it('names the assignment adding the most hours to the wall, and the week to start it', () => {
    renderSemester();
    // Big project puts 10 hours into week 6 against the Midterm's 8, and its
    // work already begins in week 5.
    expect(screen.getByTestId('start-recommendation')).toHaveTextContent(
      /Start Big project in week 5\./
    );
  });

  it('says to start now when the recommended week has already arrived', () => {
    renderSemester({ ...wallSemester, currentWeek: 5 });
    expect(screen.getByTestId('start-recommendation')).toHaveTextContent(
      /Start Big project now\./
    );
  });

  it('gives the assignment’s estimated hours', () => {
    renderSemester();
    expect(screen.getByTestId('start-recommendation')).toHaveTextContent(
      /About 20 hours of work/
    );
  });

  it('recommends nothing when every remaining week fits', () => {
    renderSemester({
      ...wallSemester,
      tasks: wallSemester.tasks.filter((task) => task.id === 'post'),
    });
    expect(screen.queryByTestId('start-recommendation')).toBeNull();
  });
});

describe('US-04 and US-05: consecutive over-capacity weeks read as one crunch period', () => {
  it('names the whole heavy stretch, not just its first week', () => {
    renderSemester();
    expect(screen.getByTestId('crunch-period')).toHaveTextContent(
      /Weeks 6–7 are over capacity/
    );
  });

  it('says nothing about a period when only one week is over capacity', () => {
    renderSemester({
      ...wallSemester,
      tasks: wallSemester.tasks.filter((task) => task.id !== 'paper'),
    });
    expect(screen.queryByTestId('crunch-period')).toBeNull();
    expect(screen.getByTestId('crunch-summary')).toHaveTextContent(
      /Week 6 needs 18 hours/
    );
  });
});
