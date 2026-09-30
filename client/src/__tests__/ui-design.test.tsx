import { fireEvent, render, screen, within } from '@testing-library/react-native';
import React from 'react';
import SemesterScreen from '../app/index';
import WeekScreen from '../app/week';
import { Semester } from '../lib/types';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';
import { categoryColor, theme } from '../theme';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => mockPush.mockClear());

/**
 * Categorised work for the UI tests, in the current week (3):
 *   overdue:  a problem set from week 2
 *   this week: an exam, a reading and a task nobody could classify
 *   next week: a project whose start week has already arrived
 */
const categorised: Semester = {
  label: 'Fall 2026',
  currentWeek: 3,
  weeklyCapacity: 10,
  courses: [
    { id: 'c1', code: 'CS 262', name: 'Software Engineering', attendance: { allowed: 4, used: 1 } },
    { id: 'c2', code: 'MATH 251', name: 'Linear Algebra', attendance: null },
    { id: 'c3', code: 'PHIL 153', name: 'Ethics', attendance: { allowed: 2, used: 2 } },
  ],
  tasks: [
    { id: 'ps', courseId: 'c2', title: 'Syllabus quiz', category: 'problemSet', dueWeek: 2, estimatedHours: 1, done: false },
    { id: 'ex', courseId: 'c2', title: 'Quiz 1', category: 'exam', dueWeek: 3, estimatedHours: 3, done: false },
    { id: 'rd', courseId: 'c3', title: 'Reading response', category: 'reading', dueWeek: 3, estimatedHours: 2, done: false },
    { id: 'un', courseId: 'c1', title: 'Mystery task', dueWeek: 3, estimatedHours: 2, done: false },
    { id: 'pj', courseId: 'c1', title: 'Prototype demo', category: 'project', dueWeek: 4, estimatedHours: 25, done: false },
  ],
};

function renderApp(semester: Semester = categorised) {
  return render(
    <SemesterProvider initial={semester}>
      <SemesterScreen />
      <WeekScreen />
    </SemesterProvider>
  );
}

const row = (id: string) => within(screen.getByTestId(`row-${id}`));

describe('This week: grouped rows', () => {
  it('groups the work under Overdue, Due this week and Next week, in that order', () => {
    renderApp();
    const headers = screen.getAllByRole('header').map((h) => h.props.children[0].props.children);
    expect(headers).toEqual(['Overdue', 'Due this week', 'Next week']);
  });

  it('puts each assignment under the right heading', () => {
    renderApp();
    expect(screen.getByTestId('row-ps')).toBeTruthy();
    expect(screen.getByTestId('row-rd')).toBeTruthy();
    expect(screen.getByTestId('row-pj')).toBeTruthy();
  });

  it('counts the items left to do', () => {
    renderApp();
    expect(screen.getByTestId('items-left')).toHaveTextContent(/5 items/);
  });

  it('counts down as work is checked off', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('done-rd'));
    expect(screen.getByTestId('items-left')).toHaveTextContent(/4 items/);
  });

  it('says "1 item" in the singular', () => {
    renderApp({ ...categorised, tasks: [categorised.tasks[0]] });
    expect(screen.getByTestId('items-left')).toHaveTextContent(/1 item$/);
  });

  it('shows how long ago overdue work was due', () => {
    renderApp();
    expect(row('ps').getByText('Was week 2')).toBeTruthy();
  });

  it('flags work that is not yet due but should be started now', () => {
    renderApp();
    // 25 hours against a capacity of 10 needs weeks 2 to 4.
    expect(row('pj').getByText('start now')).toBeTruthy();
    expect(row('rd').queryByText('start now')).toBeNull();
  });

  it('says "1 hr" in the singular', () => {
    renderApp();
    expect(row('ps').getByText('1 hr')).toBeTruthy();
  });

  it('names the course and the estimated hours on each row', () => {
    renderApp();
    expect(row('rd').getByText('PHIL 153')).toBeTruthy();
    expect(row('rd').getByText('2 hrs')).toBeTruthy();
  });

  it('marks work done with a checkbox labelled by the work it completes', () => {
    renderApp();
    const box = screen.getByLabelText('Mark Reading response done');
    expect(box.props.accessibilityRole).toBe('checkbox');
    fireEvent.press(box);
    expect(screen.queryByTestId('row-rd')).toBeNull();
  });

  it('leaves out work due after next week', () => {
    renderApp(wallSemester);
    expect(screen.queryByTestId('row-proj')).toBeNull();
  });
});

describe('Assignment categories', () => {
  it('gives each assignment a tile with its two letters', () => {
    renderApp();
    expect(row('ps').getByText('PS')).toBeTruthy();
    expect(row('ex').getByText('EX')).toBeTruthy();
    expect(row('rd').getByText('RD')).toBeTruthy();
    expect(row('pj').getByText('PJ')).toBeTruthy();
  });

  it('colours the tile by category', () => {
    renderApp();
    expect(row('ex').getByLabelText('Exam')).toHaveStyle({ backgroundColor: categoryColor('exam') });
    expect(row('rd').getByLabelText('Reading')).toHaveStyle({ backgroundColor: categoryColor('reading') });
  });

  it('gives an unclassified assignment a neutral tile with no letters', () => {
    renderApp();
    const tile = row('un').getByLabelText('No category');
    expect(tile).toHaveStyle({ backgroundColor: theme.faint });
    expect(within(tile).queryByText(/^[A-Z]{2}$/)).toBeNull();
    // It still sorts and shows like everything else.
    expect(row('un').getByText('Mystery task')).toBeTruthy();
  });

  it('uses a different colour for every category', () => {
    const colours = (['exam', 'project', 'problemSet', 'reading', 'writing', 'homework'] as const).map(
      categoryColor
    );
    expect(new Set(colours).size).toBe(6);
  });
});

describe('Semester screen: Coming up', () => {
  const up = (id: string) => within(screen.getByTestId(`up-${id}`));

  it('shows the next assignments with their category', () => {
    renderApp();
    expect(up('pj').getByText('Project')).toBeTruthy();
    expect(up('pj').getByText('Prototype demo')).toBeTruthy();
  });

  it('gives the week and course, and "Due this week" for this week’s work', () => {
    renderApp();
    expect(up('pj').getByText('Week 4 · CS 262')).toBeTruthy();
    expect(up('ex').getByText('Due this week · MATH 251')).toBeTruthy();
  });

  it('gives the estimated hours', () => {
    renderApp();
    expect(up('pj').getByText('25 hrs')).toBeTruthy();
  });

  it('shows no hours for work nobody has estimated', () => {
    renderApp({
      ...categorised,
      tasks: [{ ...categorised.tasks[3], estimatedHours: null }],
    });
    expect(within(screen.getByTestId('up-un')).queryByText(/hrs/)).toBeNull();
  });

  it('starts with the work that needs starting soonest', () => {
    renderApp();
    // The 25-hour project needs three weeks, so it starts before the quiz.
    const order = screen.getAllByTestId(/^up-/).map((n) => n.props.testID);
    expect(order[0]).toBe('up-pj');
  });

  it('shows at most four assignments', () => {
    const many = {
      ...categorised,
      tasks: [1, 2, 3, 4, 5, 6].map((n) => ({
        id: `t${n}`,
        courseId: 'c1',
        title: `Task ${n}`,
        dueWeek: 4 + n,
        estimatedHours: 2,
        done: false,
      })),
    };
    renderApp(many);
    expect(screen.getAllByTestId(/^up-/)).toHaveLength(4);
  });

  it('is left out when nothing is coming up', () => {
    renderApp({ ...categorised, tasks: [] });
    expect(screen.queryByTestId('coming-up')).toBeNull();
  });
});

describe('Semester screen: course chips', () => {
  const chips = () => within(screen.getByTestId('courses'));

  it('shows one chip per course', () => {
    renderApp();
    expect(chips().getByText('CS 262')).toBeTruthy();
    expect(chips().getByText('MATH 251')).toBeTruthy();
    expect(chips().getByText('PHIL 153')).toBeTruthy();
  });

  it('reads "no policy" for a course with no attendance policy, and "0 left" at zero', () => {
    renderApp();
    expect(chips().getByText('no policy')).toBeTruthy();
    expect(chips().getByText('0 left')).toBeTruthy();
    expect(chips().getByText('3 absences')).toBeTruthy();
  });

  it('describes each chip fully for screen readers', () => {
    renderApp();
    expect(chips().getByLabelText('MATH 251 Linear Algebra, no policy')).toBeTruthy();
  });
});

describe('Semester screen: the plan link', () => {
  it('opens the This week screen from the wall card', () => {
    renderApp();
    fireEvent.press(screen.getByTestId('plan-link'));
    expect(mockPush).toHaveBeenCalledWith('/week');
  });

  it('has no plan link when there is nothing to plan', () => {
    renderApp({ ...categorised, tasks: [] });
    expect(screen.queryByTestId('plan-link')).toBeNull();
  });
});
