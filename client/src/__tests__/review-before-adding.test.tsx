import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SyllabusScreen from '../app/syllabus';
import { addTasks, NewTask } from '../lib/api';
import { hoursInWeek, weeklyLoad } from '../lib/workload';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// No server in these tests: addTasks is replaced with a fake.
jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  addTasks: jest.fn(),
}));
const addTasksMock = addTasks as jest.MockedFunction<typeof addTasks>;

/** The fake server saves whatever it is sent and gives each one an id. */
function serverSaves() {
  addTasksMock.mockImplementation(async (tasks: NewTask[]) =>
    tasks.map((t, i) => ({ ...t, id: `${t.courseId}-syl-${i + 1}`, done: false }))
  );
}

beforeEach(() => {
  addTasksMock.mockReset();
  serverSaves();
});

jest.setTimeout(30000);

const SYLLABUS = ['Week 4: Lab report (3 hours)', 'Week 9 - Final project'].join('\n');

/** Shows the task count and week 4's forecast hours, so a test can see them change. */
function Probe() {
  const { semester } = useSemester();
  return (
    <>
      <Text testID="task-count">{semester.tasks.length}</Text>
      <Text testID="week-4-hours">{hoursInWeek(weeklyLoad(semester.tasks), 4)}</Text>
    </>
  );
}

function renderScreen() {
  render(
    <SemesterProvider initial={wallSemester}>
      <SyllabusScreen />
      <Probe />
    </SemesterProvider>
  );
}

const taskCount = () => screen.getByTestId('task-count').props.children;
const week4Hours = () => screen.getByTestId('week-4-hours').props.children;

function pasteAndFind(text = SYLLABUS) {
  fireEvent.changeText(screen.getByTestId('syllabus-input'), text);
  fireEvent.press(screen.getByTestId('syllabus-find'));
}

/** Presses Add to semester and waits for the (fake) server to answer. */
async function pressAdd() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('syllabus-add'));
  });
}

describe('US-30: fix or remove the assignments found before they are added', () => {
  it('sends the edited title, week and hours, not the scanned ones', async () => {
    renderScreen();
    pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-title-0'), 'Lab report 1');
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '5');
    fireEvent.changeText(screen.getByTestId('draft-hours-1'), '12');
    await pressAdd();

    expect(addTasksMock).toHaveBeenCalledWith([
      { courseId: 'c1', title: 'Lab report 1', dueWeek: 5, estimatedHours: 3 },
      { courseId: 'c1', title: 'Final project', dueWeek: 9, estimatedHours: 12 },
    ]);
  });

  it('removes an assignment so it is not added', async () => {
    renderScreen();
    pasteAndFind();
    fireEvent.press(screen.getByLabelText('Remove Lab report'));

    expect(screen.queryByDisplayValue('Lab report')).toBeNull();
    await pressAdd();
    expect(addTasksMock).toHaveBeenCalledWith([
      { courseId: 'c1', title: 'Final project', dueWeek: 9, estimatedHours: null },
    ]);
  });

  it('rejects a week outside 1 to 15 with a message, and sends nothing', async () => {
    renderScreen();
    pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '20');
    await pressAdd();

    expect(screen.getByText('The week must be a whole number from 1 to 15.')).toBeTruthy();
    expect(addTasksMock).not.toHaveBeenCalled();
  });

  it('rejects hours of 0 or over 100 with a message', async () => {
    renderScreen();
    pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-hours-0'), '0');
    fireEvent.changeText(screen.getByTestId('draft-hours-1'), '101');
    await pressAdd();

    expect(screen.getAllByText('Hours must be more than 0 and up to 100, or left blank.')).toHaveLength(2);
    expect(addTasksMock).not.toHaveBeenCalled();
  });

  it('rejects a blank title with a message', async () => {
    renderScreen();
    pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-title-1'), '  ');
    await pressAdd();

    expect(screen.getByText('Give the assignment a title.')).toBeTruthy();
    expect(addTasksMock).not.toHaveBeenCalled();
  });

  it('does not change the forecast while the student is still reviewing', () => {
    renderScreen();
    const count = taskCount();
    const hours = week4Hours();
    pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-hours-0'), '40');

    expect(taskCount()).toBe(count);
    expect(week4Hours()).toBe(hours);
  });

  it('adds them to the semester when the student confirms, and the forecast changes', async () => {
    renderScreen();
    const count = taskCount();
    const hours = week4Hours();
    pasteAndFind();
    await pressAdd();

    expect(taskCount()).toBe(count + 2);
    expect(week4Hours()).toBe(hours + 3);
    expect(screen.getByText('Added 2 assignments to CS 262.')).toBeTruthy();
  });

  it("shows the server's message and adds nothing when saving fails", async () => {
    addTasksMock.mockRejectedValue(new Error('Could not reach the server at http://localhost:3000'));
    renderScreen();
    const count = taskCount();
    pasteAndFind();
    await pressAdd();

    expect(screen.getByText('Could not reach the server at http://localhost:3000')).toBeTruthy();
    expect(taskCount()).toBe(count);
  });
});