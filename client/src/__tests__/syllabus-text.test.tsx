import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SyllabusScreen from '../app/syllabus';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';
import SemesterScreen from '../app/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));


jest.setTimeout(30000);

const SYLLABUS = [
  'Week 4: Lab report (3 hours)',
  'Week 9 - Final project',
  'Office hours are on Tuesdays',
].join('\n');

/** Shows how many tasks the semester has, so a test can see it did not change. */
function TaskCount() {
  const { semester } = useSemester();
  return <Text testID="task-count">{semester.tasks.length}</Text>;
}

function renderScreen() {
  return render(
    <SemesterProvider initial={wallSemester}>
      <SyllabusScreen />
      <TaskCount />
    </SemesterProvider>
  );
}

function pasteAndFind(text: string) {
  fireEvent.changeText(screen.getByTestId('syllabus-input'), text);
  fireEvent.press(screen.getByTestId('syllabus-find'));
}

describe('US-28: paste a syllabus and see the assignments found in it', () => {
  it('lets the student choose one of their courses', () => {
    renderScreen();
    for (const course of wallSemester.courses) {
      expect(screen.getByLabelText(`Choose ${course.code}`)).toBeTruthy();
    }
  });

  it('shows each assignment found, with its week and hours when stated', () => {
    renderScreen();
    pasteAndFind(SYLLABUS);
    expect(screen.getByText('Lab report')).toBeTruthy();
    expect(screen.getByText('Week 4 · 3 h')).toBeTruthy();
    expect(screen.getByText('Final project')).toBeTruthy();
    expect(screen.getByText('Week 9 · no estimate')).toBeTruthy();
  });

  it('says which course the assignments were found for', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Choose MATH 251'));
    pasteAndFind(SYLLABUS);
    expect(screen.getByText('Found 2 assignments for MATH 251')).toBeTruthy();
  });

  it('shows the lines it could not read, so nothing is silently dropped', () => {
    renderScreen();
    pasteAndFind(SYLLABUS);
    expect(screen.getByText('Could not read 1 line')).toBeTruthy();
    expect(screen.getByText('Office hours are on Tuesdays')).toBeTruthy();
  });

  it('says so when it finds nothing', () => {
    renderScreen();
    pasteAndFind('Nothing useful here');
    expect(screen.getByText('Found 0 assignments for CS 262')).toBeTruthy();
  });

  it('does not add anything to the semester', () => {
    renderScreen();
    const before = screen.getByTestId('task-count').props.children;
    pasteAndFind(SYLLABUS);
    expect(screen.getByTestId('task-count').props.children).toBe(before);
  });
});

describe('US-28: getting to the syllabus screen', () => {
    it('opens from the Semester screen', () => {
      render(
        <SemesterProvider initial={wallSemester}>
          <SemesterScreen />
        </SemesterProvider>
      );
      fireEvent.press(screen.getByTestId('go-to-syllabus'));
      expect(mockPush).toHaveBeenCalledWith('/syllabus');
    });
  });