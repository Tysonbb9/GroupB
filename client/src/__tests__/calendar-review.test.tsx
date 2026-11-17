import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CalendarScreen from '../app/calendar';
import WeekScreen from '../app/(tabs)/week';
import { CalendarLinkCard } from '../components/CalendarLinkCard';
import { addCalendarEvents, CalendarProposals, fetchCalendarEvents, fetchCalendarLinkStatus } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * US-49 (#165): review the events from a Moodle calendar before they are
 * added, like the syllabus review (US-30). wallSemester has CS 262 (c1) and
 * MATH 251 (c2), and the current week is 3.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../lib/api', () => ({
  fetchCalendarEvents: jest.fn(),
  addCalendarEvents: jest.fn(),
  fetchCalendarLinkStatus: jest.fn(),
  saveCalendarLink: jest.fn(),
  addReview: jest.fn(),
}));
const mockFetch = jest.mocked(fetchCalendarEvents);
const mockAdd = jest.mocked(addCalendarEvents);
const mockStatus = jest.mocked(fetchCalendarLinkStatus);

jest.setTimeout(30000);

const loaded: CalendarProposals = {
  proposals: [
    { eventId: 'e1', title: 'Lab 9', dueWeek: 3, courseId: 'c1', alreadyInSemester: false },
    { eventId: 'e2', title: 'Club social', dueWeek: 4, courseId: null, alreadyInSemester: false },
    { eventId: 'e3', title: 'Midterm', dueWeek: 6, courseId: 'c2', alreadyInSemester: true },
  ],
  alreadyAdded: 2,
  outsideSemester: 1,
};

beforeEach(() => {
  mockPush.mockClear();
  mockFetch.mockReset();
  mockAdd.mockReset();
  mockStatus.mockReset();
});

/** The review screen with This week beside it, so a test can see the tasks arrive. */
async function renderReview(result: CalendarProposals = loaded) {
  mockFetch.mockResolvedValue(result);
  render(
    <SemesterProvider initial={wallSemester}>
      <CalendarScreen />
      <WeekScreen />
    </SemesterProvider>
  );
  await act(async () => {});
}

const pressAdd = async () => {
  fireEvent.press(screen.getByTestId('calendar-add'));
  await act(async () => {});
};

describe('what the review shows', () => {
  it('says it is reading the calendar until the events arrive', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(
      <SemesterProvider initial={wallSemester}>
        <CalendarScreen />
      </SemesterProvider>
    );
    expect(screen.getByText('Reading your Moodle calendar…')).toBeTruthy();
  });

  it('shows each event as an assignment to check, with its title and week', async () => {
    await renderReview();
    expect(screen.getByTestId('calendar-review-banner')).toBeTruthy();
    expect(screen.getByText(/Found 3 new assignments/)).toBeTruthy();
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Lab 9');
    expect(screen.getByTestId('draft-week-0').props.value).toBe('3');
    expect(screen.getByTestId('draft-hours-0').props.value).toBe('');
  });

  it('shows the matched course chosen, and asks which course for an unmatched one', async () => {
    await renderReview();
    expect(screen.getByRole('button', { name: 'Put Lab 9 in CS 262' })).toBeSelected();
    expect(screen.getByText('Which course?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Put Club social in CS 262' })).not.toBeSelected();
  });

  it('never marks an unplaced event ready to add', async () => {
    await renderReview();
    expect(screen.getByLabelText('Assignment 1: ready to add')).toBeTruthy();
    expect(screen.getByLabelText('Assignment 2: needs review')).toBeTruthy();
    expect(screen.getByTestId('draft-duplicate-hint-1')).toHaveTextContent('Choose the course this belongs to, above.');
  });

  it('marks it ready once the student places it', async () => {
    await renderReview();
    fireEvent.press(screen.getByRole('button', { name: 'Put Club social in MATH 251' }));
    expect(screen.getByLabelText('Assignment 2: ready to add')).toBeTruthy();
  });

  it('warns about an event the syllabus already added', async () => {
    await renderReview();
    expect(screen.getByTestId('draft-duplicate-hint-2')).toHaveTextContent(
      'Already in your semester for MATH 251, week 6. Remove it unless it is a different assignment.'
    );
  });

  it('says what it left out, and why', async () => {
    await renderReview();
    expect(screen.getByTestId('calendar-skipped')).toHaveTextContent(
      'Not shown: 2 events were added before, and 1 event falls outside weeks 1 to 15.'
    );
  });

  it('says when there is nothing new', async () => {
    await renderReview({ proposals: [], alreadyAdded: 4, outsideSemester: 0 });
    expect(screen.getByTestId('calendar-nothing-new')).toHaveTextContent('Nothing new in your Moodle calendar.');
    expect(screen.queryByTestId('calendar-add')).toBeNull();
  });

  it("shows the server's message in plain words when the calendar cannot be read", async () => {
    mockFetch.mockRejectedValue(new Error('Moodle did not accept that link. Copy a new calendar link from Moodle.'));
    render(
      <SemesterProvider initial={wallSemester}>
        <CalendarScreen />
      </SemesterProvider>
    );
    expect(await screen.findByTestId('calendar-load-error')).toHaveTextContent(
      'Moodle did not accept that link. Copy a new calendar link from Moodle.'
    );
  });
});

describe('adding', () => {
  it('refuses to add until every event has a course, and says which', async () => {
    await renderReview();
    await pressAdd();
    expect(mockAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Choose the course this belongs to.')).toBeTruthy();
    expect(screen.getByTestId('calendar-status')).toHaveTextContent('Fix the highlighted assignments first.');
  });

  it('sends the kept events with their event ids, courses, weeks and any hours typed', async () => {
    mockAdd.mockResolvedValue([]);
    await renderReview();
    fireEvent.press(screen.getByRole('button', { name: 'Put Club social in MATH 251' }));
    fireEvent.changeText(screen.getByTestId('draft-hours-0'), '2');
    fireEvent.changeText(screen.getByTestId('draft-week-1'), '5');
    await pressAdd();

    expect(mockAdd).toHaveBeenCalledWith([
      { eventId: 'e1', courseId: 'c1', title: 'Lab 9', dueWeek: 3, estimatedHours: 2 },
      { eventId: 'e2', courseId: 'c2', title: 'Club social', dueWeek: 5, estimatedHours: null },
      { eventId: 'e3', courseId: 'c2', title: 'Midterm', dueWeek: 6, estimatedHours: null },
    ]);
  });

  it('leaves out an event the student removed', async () => {
    mockAdd.mockResolvedValue([]);
    await renderReview();
    fireEvent.press(screen.getByRole('button', { name: 'Remove Club social' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove Midterm' }));
    await pressAdd();
    expect(mockAdd).toHaveBeenCalledWith([expect.objectContaining({ eventId: 'e1' })]);
  });

  it('puts the added tasks in the semester and says how many', async () => {
    mockAdd.mockResolvedValue([
      { id: 'c1-syl-1', courseId: 'c1', title: 'Lab 9', dueWeek: 3, estimatedHours: null, done: false },
    ]);
    await renderReview({ ...loaded, proposals: [loaded.proposals[0]] });
    await pressAdd();

    expect(screen.getByTestId('calendar-status')).toHaveTextContent('Added 1 assignment from your Moodle calendar.');
    expect(screen.getByTestId('row-c1-syl-1')).toBeTruthy(); // on This week, due week 3
    expect(screen.queryByTestId('calendar-add')).toBeNull();
  });

  it('refuses a bad week before sending, like the syllabus review', async () => {
    await renderReview({ ...loaded, proposals: [loaded.proposals[0]] });
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '16');
    await pressAdd();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("keeps the list, and shows the server's message, when adding fails", async () => {
    mockAdd.mockRejectedValue(new Error('Task 1: that calendar event was already added'));
    await renderReview({ ...loaded, proposals: [loaded.proposals[0]] });
    await pressAdd();
    expect(screen.getByTestId('calendar-status')).toHaveTextContent('Task 1: that calendar event was already added');
    expect(screen.getByTestId('draft-title-0')).toBeTruthy();
  });
});

describe('the way in, from the Courses card', () => {
  it('offers Review calendar events once a link is saved', async () => {
    mockStatus.mockResolvedValue({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' });
    render(<CalendarLinkCard />);
    fireEvent.press(await screen.findByRole('button', { name: 'Review the events in your Moodle calendar' }));
    expect(mockPush).toHaveBeenCalledWith('/calendar');
  });

  it('does not offer it before a link is saved', async () => {
    mockStatus.mockResolvedValue({ saved: false, savedAt: null });
    render(<CalendarLinkCard />);
    await screen.findByTestId('calendar-link-input');
    expect(screen.queryByTestId('calendar-review')).toBeNull();
  });
});
