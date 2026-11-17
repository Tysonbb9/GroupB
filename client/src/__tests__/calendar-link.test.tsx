import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import CoursesScreen from '../app/(tabs)/courses';
import { fetchCalendarLinkStatus, fetchSemester, saveCalendarLink } from '../lib/api';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * US-48 (#164): paste a Moodle calendar link once, on the Courses tab. The
 * server checks and saves it; the phone never shows it again once saved.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  fetchCalendarLinkStatus: jest.fn(),
  saveCalendarLink: jest.fn(),
}));
const mockFetchSemester = jest.mocked(fetchSemester);
const mockStatus = jest.mocked(fetchCalendarLinkStatus);
const mockSave = jest.mocked(saveCalendarLink);

jest.setTimeout(30000);

const LINK = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=1&authtoken=secret-token';

beforeEach(() => {
  mockFetchSemester.mockReset();
  mockStatus.mockReset();
  mockSave.mockReset();
});

/** Courses with the semester from the (fake) server, which is when the card shows. */
async function renderCourses() {
  mockFetchSemester.mockResolvedValue(wallSemester);
  render(
    <SemesterProvider>
      <CoursesScreen />
    </SemesterProvider>
  );
  await screen.findByTestId('calendar-link');
}

const paste = (text: string) => fireEvent.changeText(screen.getByTestId('calendar-link-input'), text);
const pressSave = async () => {
  fireEvent.press(screen.getByTestId('calendar-link-save'));
  await act(async () => {});
};

describe('before a link is saved', () => {
  beforeEach(() => mockStatus.mockResolvedValue({ saved: false, savedAt: null }));

  it('offers a box to paste the link, with where to find it in Moodle', async () => {
    await renderCourses();
    expect(screen.getByLabelText('Moodle calendar link')).toBeTruthy();
    expect(screen.getByText(/Export calendar, and tap Get calendar URL/)).toBeTruthy();
    expect(screen.queryByTestId('calendar-link-status')).toBeNull();
  });

  it('saves a pasted link, then empties the box and says it is connected', async () => {
    mockSave.mockResolvedValue({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' });
    await renderCourses();
    paste(`  ${LINK}  `);
    await pressSave();

    expect(mockSave).toHaveBeenCalledWith(LINK);
    expect(screen.getByTestId('calendar-link-status')).toHaveTextContent(/Connected · saved Nov 16/);
    expect(screen.queryByTestId('calendar-link-input')).toBeNull();
  });

  it('never shows the link again once it is saved', async () => {
    mockSave.mockResolvedValue({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' });
    await renderCourses();
    paste(LINK);
    await pressSave();
    expect(JSON.stringify(screen.toJSON())).not.toContain('secret-token');
  });

  it("shows the server's reason, keeps the box and its text, when the link is refused", async () => {
    mockSave.mockRejectedValue(new Error('The link must be a calendar link from moodle.calvin.edu.'));
    await renderCourses();
    paste('https://example.com/cal.ics');
    await pressSave();

    expect(screen.getByTestId('calendar-link-problem')).toHaveTextContent(
      'The link must be a calendar link from moodle.calvin.edu.'
    );
    expect(screen.getByTestId('calendar-link-input').props.value).toBe('https://example.com/cal.ics');
  });

  it('asks for a link without calling the server when the box is empty', async () => {
    await renderCourses();
    paste('   ');
    await pressSave();
    expect(screen.getByTestId('calendar-link-problem')).toHaveTextContent('Paste your Moodle calendar link.');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('says Checking… and cannot be pressed twice while it saves', async () => {
    mockSave.mockReturnValue(new Promise(() => {}));
    await renderCourses();
    paste(LINK);
    fireEvent.press(screen.getByTestId('calendar-link-save'));
    expect(await screen.findByText('Checking…')).toBeTruthy();
    fireEvent.press(screen.getByTestId('calendar-link-save'));
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('clears the problem as soon as the student types again', async () => {
    mockSave.mockRejectedValue(new Error('Moodle could not be reached. Try again in a moment.'));
    await renderCourses();
    paste(LINK);
    await pressSave();
    paste(`${LINK}x`);
    expect(screen.queryByTestId('calendar-link-problem')).toBeNull();
  });
});

describe('when a link is already saved', () => {
  beforeEach(() => mockStatus.mockResolvedValue({ saved: true, savedAt: '2026-11-10T15:00:00.000Z' }));

  it('says it is connected and when, with no box', async () => {
    await renderCourses();
    expect(screen.getByTestId('calendar-link-status')).toHaveTextContent(/Connected · saved Nov 10/);
    expect(screen.queryByTestId('calendar-link-input')).toBeNull();
  });

  it('Replace link opens an empty box, and Cancel closes it', async () => {
    await renderCourses();
    fireEvent.press(screen.getByRole('button', { name: 'Replace your Moodle calendar link' }));
    expect(screen.getByTestId('calendar-link-input').props.value).toBe('');
    fireEvent.press(screen.getByTestId('calendar-link-cancel'));
    expect(screen.queryByTestId('calendar-link-input')).toBeNull();
  });

  it('saves a replacement and shows the new date', async () => {
    mockSave.mockResolvedValue({ saved: true, savedAt: '2026-11-16T20:00:00.000Z' });
    await renderCourses();
    fireEvent.press(screen.getByRole('button', { name: 'Replace your Moodle calendar link' }));
    paste(LINK);
    await pressSave();
    expect(screen.getByTestId('calendar-link-status')).toHaveTextContent(/saved Nov 16/);
  });
});

describe('when the status cannot be read', () => {
  it('still offers the box', async () => {
    mockStatus.mockRejectedValue(new Error('Could not reach the server at http://x'));
    await renderCourses();
    expect(screen.getByLabelText('Moodle calendar link')).toBeTruthy();
  });
});

describe('with sample data on the device', () => {
  it('shows no calendar card, since there is no server to save the link', () => {
    render(
      <SemesterProvider initial={wallSemester}>
        <CoursesScreen />
      </SemesterProvider>
    );
    expect(screen.queryByTestId('calendar-link')).toBeNull();
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
