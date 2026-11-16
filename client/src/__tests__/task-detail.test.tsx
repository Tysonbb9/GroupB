import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import WeekScreen from '../app/(tabs)/week';
import TaskDetailScreen from '../app/task/[id]';
import { TaskRow } from '../components/TaskRow';
import { WeekStrip } from '../components/WeekStrip';
import { fetchSemester, updateTask } from '../lib/api';
import { Semester } from '../lib/types';
import { weeklyLoad } from '../lib/workload';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * US-44 (#159): tapping an assignment opens its details, where its hours can
 * be changed. The new hours are saved on the server (PATCH /tasks/:id) before
 * the forecast uses them.
 */

const mockPush = jest.fn();
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

// No server in these tests: the calls the screens make are fakes.
jest.mock('../lib/api', () => ({
  addReview: jest.fn(),
  fetchSemester: jest.fn(),
  fetchCheckinQuestion: jest.fn(async () => null),
  updateTask: jest.fn(),
}));
const mockFetchSemester = jest.mocked(fetchSemester);
const mockUpdateTask = jest.mocked(updateTask);

jest.setTimeout(30000);

beforeEach(() => {
  mockPush.mockClear();
  mockFetchSemester.mockReset();
  mockUpdateTask.mockReset();
  mockParams = {};
});

/** The Forecast strip, drawn from the same store, so a test can see the forecast change. */
function Strip() {
  const { semester } = useSemester();
  return (
    <WeekStrip
      loads={weeklyLoad(semester.tasks)}
      capacity={semester.weeklyCapacity}
      currentWeek={semester.currentWeek}
      selectedWeek={semester.currentWeek}
      wallWeek={null}
      onSelectWeek={jest.fn()}
    />
  );
}

/** The details of one task, with the strip beside them, on this device only (no server). */
function renderDetail(id: string, semester: Semester = wallSemester) {
  mockParams = { id };
  return render(
    <SemesterProvider initial={semester}>
      <TaskDetailScreen />
      <Strip />
    </SemesterProvider>
  );
}

/** The same, with the semester loaded from the (fake) server. */
async function renderDetailFromServer(id: string) {
  mockParams = { id };
  mockFetchSemester.mockResolvedValue(wallSemester);
  render(
    <SemesterProvider>
      <TaskDetailScreen />
      <Strip />
    </SemesterProvider>
  );
  await screen.findByTestId('task-title');
}

const typeHours = (text: string) => fireEvent.changeText(screen.getByTestId('task-hours-input'), text);
const pressSave = () => fireEvent.press(screen.getByRole('button', { name: /^Save hours for/ }));

describe('the row opens the details', () => {
  function renderWeek() {
    render(
      <SemesterProvider initial={wallSemester}>
        <WeekScreen />
      </SemesterProvider>
    );
  }

  it('opens the task tapped, by its id', () => {
    renderWeek();
    fireEvent.press(screen.getByTestId('open-post'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 'post' } });
  });

  it('can be opened by a screen reader through the title', () => {
    renderWeek();
    fireEvent.press(screen.getByRole('button', { name: 'Discussion post, CS 262' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 'post' } });
  });

  it('still ticks a task off from the row, without opening it', () => {
    renderWeek();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Discussion post done' }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText('Marked done')).toBeTruthy();
  });

  it('still adds an estimate from the row, without opening it', () => {
    renderWeek();
    fireEvent.press(screen.getByRole('button', { name: 'Add estimate for Discussion post' }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Estimated hours for Discussion post')).toBeTruthy();
  });

  it('does not open when no one asked it to', () => {
    render(
      <TaskRow
        task={wallSemester.tasks[0]}
        courseCode="CS 262"
        overdueSince={null}
        startNow={false}
        onDone={jest.fn()}
        onEstimate={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Big project, CS 262' })).toBeNull();
  });
});

describe('what the details show', () => {
  it('shows the title, the course, the due week and the hours', () => {
    renderDetail('exam');
    expect(screen.getByTestId('task-title')).toHaveTextContent('Midterm');
    expect(screen.getByText('MATH 251 · Linear Algebra')).toBeTruthy();
    expect(screen.getByLabelText('Due: Week 6')).toBeTruthy();
    expect(screen.getByLabelText('Hours: 8 hours')).toBeTruthy();
    expect(screen.getByLabelText('Status: To do')).toBeTruthy();
  });

  it('shows the weeks a long task is worked on', () => {
    renderDetail('proj');
    expect(screen.getByLabelText('Worked on: Weeks 5–6')).toBeTruthy();
  });

  it('leaves out "worked on" for a task done in one week', () => {
    renderDetail('exam');
    expect(screen.queryByTestId('task-spread')).toBeNull();
  });

  it('says a task has no hours yet, and leaves the box empty', () => {
    renderDetail('post');
    expect(screen.getByLabelText('Hours: Not set yet')).toBeTruthy();
    expect(screen.getByTestId('task-hours-input').props.value).toBe('');
  });

  it('starts the box at the hours the task has', () => {
    renderDetail('exam');
    expect(screen.getByTestId('task-hours-input').props.value).toBe('8');
  });

  it('says when a task not done is past its week', () => {
    renderDetail('post', { ...wallSemester, currentWeek: 5 });
    expect(screen.getByLabelText('Due: Week 3 · overdue')).toBeTruthy();
  });

  it('does not call a finished task overdue', () => {
    renderDetail('gone', { ...wallSemester, currentWeek: 9 });
    expect(screen.getByLabelText('Due: Week 5')).toBeTruthy();
    expect(screen.getByLabelText('Status: Done')).toBeTruthy();
  });

  it('names the kind of work, or says it is not sorted', () => {
    const withKind: Semester = {
      ...wallSemester,
      tasks: wallSemester.tasks.map((t) => (t.id === 'exam' ? { ...t, category: 'exam' } : t)),
    };
    renderDetail('exam', withKind);
    expect(screen.getByLabelText('Kind: Exam')).toBeTruthy();
    screen.unmount();
    renderDetail('paper');
    expect(screen.getByLabelText('Kind: Not sorted')).toBeTruthy();
  });

  it('says so when the task is no longer there', () => {
    renderDetail('deleted');
    expect(screen.getByTestId('task-missing')).toHaveTextContent('This assignment is no longer in your semester.');
  });

  it('uses "1 hour", not "1 hours"', () => {
    const one: Semester = {
      ...wallSemester,
      tasks: wallSemester.tasks.map((t) => (t.id === 'exam' ? { ...t, estimatedHours: 1 } : t)),
    };
    renderDetail('exam', one);
    expect(screen.getByLabelText('Hours: 1 hour')).toBeTruthy();
  });
});

describe('changing the hours', () => {
  it('uses the new hours everywhere once saved', async () => {
    renderDetail('exam');
    // Week 6 is Big project (10) + Midterm (8).
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();

    typeHours('12');
    pressSave();

    expect(await screen.findByTestId('task-hours-saved')).toBeTruthy();
    expect(screen.getByLabelText('Hours: 12 hours')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 22 hours')).toBeTruthy();
  });

  it('takes decimals', async () => {
    renderDetail('exam');
    typeHours('2.5');
    pressSave();
    expect(await screen.findByLabelText('Hours: 2.5 hours')).toBeTruthy();
  });

  it('clears the hours when the box is left blank', async () => {
    renderDetail('exam');
    typeHours('');
    pressSave();
    expect(await screen.findByLabelText('Hours: Not set yet')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 10 hours')).toBeTruthy();
  });

  it.each(['0', '-3', '101', 'abc', '3 hours'])('refuses %p and changes nothing', (text) => {
    renderDetail('exam');
    typeHours(text);
    pressSave();
    expect(screen.getByTestId('task-hours-problem')).toHaveTextContent(
      'Enter hours more than 0 and up to 100, or leave it blank.'
    );
    expect(screen.getByLabelText('Hours: 8 hours')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
  });

  it('accepts the most there can be, 100', async () => {
    renderDetail('exam');
    typeHours('100');
    pressSave();
    expect(await screen.findByLabelText('Hours: 100 hours')).toBeTruthy();
  });

  it('clears an old problem once the hours are saved', async () => {
    renderDetail('exam');
    typeHours('abc');
    pressSave();
    typeHours('9');
    pressSave();
    expect(await screen.findByTestId('task-hours-saved')).toBeTruthy();
    expect(screen.queryByTestId('task-hours-problem')).toBeNull();
  });

  it('hides "Saved" again as soon as the student types', async () => {
    renderDetail('exam');
    typeHours('9');
    pressSave();
    await screen.findByTestId('task-hours-saved');
    typeHours('10');
    expect(screen.queryByTestId('task-hours-saved')).toBeNull();
  });
});

describe('saving on the server', () => {
  it('saves the hours with PATCH /tasks/:id, then shows them', async () => {
    mockUpdateTask.mockResolvedValue({ ...wallSemester.tasks[1], estimatedHours: 12 });
    await renderDetailFromServer('exam');

    typeHours('12');
    pressSave();

    expect(await screen.findByTestId('task-hours-saved')).toBeTruthy();
    expect(mockUpdateTask).toHaveBeenCalledWith('exam', { estimatedHours: 12 });
    expect(screen.getByLabelText('Week 6, 22 hours')).toBeTruthy();
  });

  it('uses the hours the server kept', async () => {
    mockUpdateTask.mockResolvedValue({ ...wallSemester.tasks[1], estimatedHours: 11 });
    await renderDetailFromServer('exam');

    typeHours('12');
    pressSave();

    expect(await screen.findByLabelText('Hours: 11 hours')).toBeTruthy();
  });

  it('sends null to clear the hours', async () => {
    mockUpdateTask.mockResolvedValue({ ...wallSemester.tasks[1], estimatedHours: null });
    await renderDetailFromServer('exam');

    typeHours('');
    pressSave();

    expect(await screen.findByLabelText('Hours: Not set yet')).toBeTruthy();
    expect(mockUpdateTask).toHaveBeenCalledWith('exam', { estimatedHours: null });
  });

  it('keeps the old hours, and says why, when saving fails', async () => {
    mockUpdateTask.mockRejectedValue(new Error('Could not reach the server at http://x'));
    await renderDetailFromServer('exam');

    typeHours('12');
    pressSave();

    expect(await screen.findByTestId('task-hours-problem')).toHaveTextContent(
      'Could not save, so the hours have not changed. Could not reach the server at http://x'
    );
    expect(screen.getByLabelText('Hours: 8 hours')).toBeTruthy();
    expect(screen.getByLabelText('Week 6, 18 hours')).toBeTruthy();
    expect(screen.queryByTestId('task-hours-saved')).toBeNull();
  });

  it('says Saving… and cannot be pressed twice while it saves', async () => {
    let finish: (value: Awaited<ReturnType<typeof updateTask>>) => void = () => {};
    mockUpdateTask.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderDetailFromServer('exam');

    typeHours('12');
    pressSave();

    expect(await screen.findByText('Saving…')).toBeTruthy();
    pressSave();
    expect(mockUpdateTask).toHaveBeenCalledTimes(1);

    finish({ ...wallSemester.tasks[1], estimatedHours: 12 });
    await waitFor(() => expect(screen.getByTestId('task-hours-saved')).toBeTruthy());
  });

  it('does not call the server when the hours are the same', async () => {
    await renderDetailFromServer('exam');

    typeHours('8');
    pressSave();

    expect(await screen.findByTestId('task-hours-saved')).toBeTruthy();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('does not call the server for hours it refuses', async () => {
    await renderDetailFromServer('exam');

    typeHours('101');
    pressSave();

    expect(screen.getByTestId('task-hours-problem')).toBeTruthy();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});
