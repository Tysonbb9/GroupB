import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SyllabusScreen from '../app/syllabus';
import { addTasks, extractSyllabusText } from '../lib/api';
import { pickPdf } from '../lib/pick-pdf';
import { SemesterProvider, useSemester } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// No file picker and no server in these tests: both are replaced with fakes.
jest.mock('../lib/pick-pdf', () => ({ pickPdf: jest.fn() }));
jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  addTasks: jest.fn(),
  extractSyllabusText: jest.fn(),
}));
const pickPdfMock = pickPdf as jest.MockedFunction<typeof pickPdf>;
const extractMock = extractSyllabusText as jest.MockedFunction<typeof extractSyllabusText>;
const addTasksMock = addTasks as jest.MockedFunction<typeof addTasks>;

jest.setTimeout(30000);

const pdf = new Blob(['%PDF-1.7']);
const PDF_TEXT = ['Week 4: Lab report (3 hours)', 'Week 9 - Final project', 'Office hours are on Tuesdays'].join('\n');
const NO_TEXT =
  'The PDF has no text in it. It may be a scanned image: try a PDF where you can select the text, or paste the syllabus text instead.';

beforeEach(() => {
  pickPdfMock.mockReset();
  extractMock.mockReset();
  addTasksMock.mockReset();
  pickPdfMock.mockResolvedValue(pdf);
  extractMock.mockResolvedValue({ text: PDF_TEXT, pageCount: 1, lineCount: 3, pagesWithoutText: [] });
});

function TaskCount() {
  const { semester } = useSemester();
  return <Text testID="task-count">{semester.tasks.length}</Text>;
}

function renderScreen() {
  render(
    <SemesterProvider initial={wallSemester}>
      <SyllabusScreen />
      <TaskCount />
    </SemesterProvider>
  );
}

/** Presses Choose PDF and waits for the (fake) picker and server. */
async function choosePdf() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('syllabus-pdf'));
  });
}

describe('US-29: upload a syllabus PDF', () => {
  it('sends the chosen PDF to the server', async () => {
    renderScreen();
    await choosePdf();
    expect(extractMock).toHaveBeenCalledWith(pdf);
  });

  it("scans the PDF's text like pasted text, ready to review", async () => {
    renderScreen();
    await choosePdf();

    expect(screen.getByText('Found 2 assignments for CS 262')).toBeTruthy();
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Lab report');
    expect(screen.getByTestId('draft-hours-0').props.value).toBe('3');
    expect(screen.getByText('Office hours are on Tuesdays')).toBeTruthy();
  });

  it('puts the text it read in the text box, so the student can see and fix it', async () => {
    renderScreen();
    await choosePdf();
    expect(screen.getByTestId('syllabus-input').props.value).toBe(PDF_TEXT);
  });

  it('does nothing when the student cancels the picker', async () => {
    pickPdfMock.mockResolvedValue(null);
    renderScreen();
    await choosePdf();

    expect(extractMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Found/)).toBeNull();
  });

  it('says so for a PDF with no readable text, and offers the text box instead', async () => {
    extractMock.mockRejectedValue(new Error(NO_TEXT));
    renderScreen();
    await choosePdf();

    expect(screen.getByText(NO_TEXT)).toBeTruthy();
    // The paste option is still there and still works.
    fireEvent.changeText(screen.getByTestId('syllabus-input'), 'Week 2: Quiz (1 hour)');
    fireEvent.press(screen.getByTestId('syllabus-find'));
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Quiz');
  });

  it("shows the server's message when it refuses the file", async () => {
    extractMock.mockRejectedValue(new Error('The PDF is larger than 10 MB.'));
    renderScreen();
    await choosePdf();
    expect(screen.getByText('The PDF is larger than 10 MB.')).toBeTruthy();
  });

  it('adds nothing to the semester until the student confirms', async () => {
    renderScreen();
    const before = screen.getByTestId('task-count').props.children;
    await choosePdf();

    expect(addTasksMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('task-count').props.children).toBe(before);
  });
});