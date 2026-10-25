import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import { SyllabusReminder } from '../components/SyllabusReminder';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Jest stops a test after 5 seconds. The first render of the whole Semester
// screen can pass that when the full suite runs on a busy machine.
jest.setTimeout(30000);

describe('US-26: be reminded to update my syllabus', () => {
  it('says in words what to do and why', () => {
    render(<SyllabusReminder />);
    expect(screen.getByText('Keep your syllabi up to date')).toBeTruthy();
    expect(
      screen.getByText(/If a class changed its schedule, update its syllabus/)
    ).toBeTruthy();
  });

  it('is labelled for screen readers', () => {
    render(<SyllabusReminder />);
    expect(screen.getByLabelText(/Reminder: keep your syllabi up to date/)).toBeTruthy();
  });

  it('goes away when the student dismisses it', () => {
    render(<SyllabusReminder />);
    fireEvent.press(screen.getByTestId('syllabus-reminder-dismiss'));
    expect(screen.queryByTestId('syllabus-reminder')).toBeNull();
  });

  it('offers the dismiss control as a labelled button', () => {
    render(<SyllabusReminder />);
    expect(screen.getByLabelText('Dismiss the syllabus reminder')).toBeTruthy();
  });

  it('shows on the Semester screen', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(screen.getByTestId('syllabus-reminder')).toBeTruthy();
  });

  it('replaces the old one-line text on the Semester screen', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <SemesterScreen />
      </SemesterProvider>
    );
    expect(screen.queryByText(/re-upload your syllabus at any time/)).toBeNull();
  });
});
