import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import SyllabusScreen from '../app/syllabus';
import { addTasks, AiReading, extractSyllabusText, getAiStatus, readSyllabusWithAi } from '../lib/api';
import { pickPdf } from '../lib/pick-pdf';
import { SemesterProvider } from '../state/semester-store';
import { wallSemester } from '../testing/fixtures';

/**
 * Issue #145, screen 1: when the server has an AI, Find assignments asks it
 * to read the syllabus, and its answer fills the same review boxes. Without
 * the AI, or when it fails, the simple scanner runs. No server and no AI are
 * used here: both are replaced with fakes.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('../lib/pick-pdf', () => ({ pickPdf: jest.fn() }));
jest.mock('../lib/api', () => ({
  fetchSemester: jest.fn(),
  addTasks: jest.fn(),
  extractSyllabusText: jest.fn(),
  getAiStatus: jest.fn(),
  readSyllabusWithAi: jest.fn(),
}));

const statusMock = getAiStatus as jest.MockedFunction<typeof getAiStatus>;
const readMock = readSyllabusWithAi as jest.MockedFunction<typeof readSyllabusWithAi>;
const extractMock = extractSyllabusText as jest.MockedFunction<typeof extractSyllabusText>;
const addTasksMock = addTasks as jest.MockedFunction<typeof addTasks>;
const pickPdfMock = pickPdf as jest.MockedFunction<typeof pickPdf>;

jest.setTimeout(30000);

const SYLLABUS = 'Week 4: Prototype demo (about 6 hours)\nWeek 6: Sprint 1 review\nWeekly quizzes on Fridays.';

const READING: AiReading = {
  assignments: [
    { title: 'Prototype demo', dueWeek: 4, estimatedHours: 6 },
    { title: 'Sprint 1 review', dueWeek: 6, estimatedHours: null },
    { title: 'Weekly quizzes', dueWeek: null, estimatedHours: null },
  ],
  weights: [
    { label: 'Team project', percent: 40 },
    { label: 'Exams', percent: 30 },
  ],
  policies: { absencesAllowed: 4, dropRule: 'Lowest quiz dropped' },
  dropped: 0,
};

beforeEach(() => {
  statusMock.mockReset();
  readMock.mockReset();
  extractMock.mockReset();
  pickPdfMock.mockReset();
  addTasksMock.mockReset();
});

async function renderScreen(aiAvailable: boolean) {
  statusMock.mockResolvedValue(aiAvailable);
  render(
    <SemesterProvider initial={wallSemester}>
      <SyllabusScreen />
    </SemesterProvider>
  );
  await act(async () => {}); // lets the status answer arrive
}

async function pasteAndFind(text = SYLLABUS) {
  fireEvent.changeText(screen.getByTestId('syllabus-input'), text);
  await act(async () => {
    fireEvent.press(screen.getByTestId('syllabus-find'));
  });
}

describe('with an AI on the server', () => {
  it('sends the text to the AI and fills the boxes with what it read', async () => {
    readMock.mockResolvedValue(READING);
    await renderScreen(true);

    await pasteAndFind();

    expect(readMock).toHaveBeenCalledWith(SYLLABUS);
    expect(screen.getByText('What we found. Check it before it reaches your forecast.')).toBeTruthy();
    expect(screen.getByText('ASSIGNMENTS')).toBeTruthy();
    expect(screen.getByText('3 FOUND')).toBeTruthy();
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Prototype demo');
    expect(screen.getByTestId('draft-week-0').props.value).toBe('4');
    expect(screen.getByTestId('draft-hours-0').props.value).toBe('6');
    expect(screen.getByTestId('draft-hours-1').props.value).toBe('');
    expect(screen.getByText(`Found 3 assignments for ${wallSemester.courses[0].code}`)).toBeTruthy();
  });

  it('leaves a week the AI did not find empty, says so, and will not add until it is filled', async () => {
    readMock.mockResolvedValue(READING);
    await renderScreen(true);
    await pasteAndFind();

    expect(screen.getByTestId('draft-week-2').props.value).toBe('');
    expect(screen.getByTestId('draft-week-hint-2')).toBeTruthy();
    expect(screen.queryByTestId('draft-week-hint-0')).toBeNull();
    expect(screen.getByTestId('syllabus-blocker')).toHaveTextContent('1 assignment needs a week before it can be added.');

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-add'));
    });
    expect(screen.getByText('Fix the highlighted assignments first.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('draft-week-2'), '8');
    expect(screen.queryByTestId('draft-week-hint-2')).toBeNull();
    expect(screen.queryByTestId('syllabus-blocker')).toBeNull();
  });

  it('shows the grade weights and policies it found, marked as not saved', async () => {
    readMock.mockResolvedValue(READING);
    await renderScreen(true);
    await pasteAndFind();

    expect(screen.getByTestId('syllabus-ai-extras')).toBeTruthy();
    expect(screen.getByText('GRADE WEIGHTS')).toBeTruthy();
    expect(screen.getByText('Team project')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('Exams')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
    expect(screen.getByText('POLICIES')).toBeTruthy();
    expect(screen.getByText('Absences allowed')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Lowest quiz dropped')).toBeTruthy();
    expect(screen.getByText('For your information. These are not saved yet.')).toBeTruthy();
  });

  it('shows no extras box when the AI found no weights or policies', async () => {
    readMock.mockResolvedValue({ ...READING, weights: [], policies: { absencesAllowed: null, dropRule: null } });
    await renderScreen(true);
    await pasteAndFind();

    expect(screen.queryByTestId('syllabus-ai-extras')).toBeNull();
  });

  it('shows a waiting message while the AI reads, and disables the button', async () => {
    let finish: (reading: AiReading) => void = () => {};
    readMock.mockReturnValue(new Promise<AiReading>((resolve) => (finish = resolve)));
    await renderScreen(true);

    fireEvent.changeText(screen.getByTestId('syllabus-input'), SYLLABUS);
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-find'));
    });

    expect(screen.getByTestId('syllabus-ai-wait')).toBeTruthy();
    expect(screen.getAllByText('Reading your syllabus…').length).toBeGreaterThan(0);
    expect(screen.getByTestId('syllabus-find').props.accessibilityState.disabled).toBe(true);

    await act(async () => finish(READING));

    expect(screen.queryByTestId('syllabus-ai-wait')).toBeNull();
    expect(screen.getByTestId('draft-title-0')).toBeTruthy();
  });

  it('falls back to the simple scanner, and says so, when the AI fails', async () => {
    readMock.mockRejectedValue(new Error('The AI service could not be reached. Try again in a moment.'));
    await renderScreen(true);

    await pasteAndFind('Week 4: Lab report (3 hours)\nWeek 9 - Final project');

    expect(screen.getByTestId('syllabus-ai-note')).toBeTruthy();
    // It says why, in the server's own words.
    expect(screen.getByTestId('syllabus-ai-note').props.children).toBe(
      'Reading with AI did not work this time (The AI service could not be reached. Try again in a moment.), so the simple scanner was used instead.'
    );
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Lab report');
    expect(screen.getByTestId('draft-week-0').props.value).toBe('4');
    expect(screen.getByTestId('draft-hours-0').props.value).toBe('3');
    expect(screen.queryByTestId('syllabus-ai-extras')).toBeNull();
  });

  it('reads a PDF\'s text with the AI too', async () => {
    pickPdfMock.mockResolvedValue(new Blob(['%PDF-1.7']));
    extractMock.mockResolvedValue({ text: SYLLABUS, pageCount: 1, lineCount: 3, pagesWithoutText: [] });
    readMock.mockResolvedValue(READING);
    await renderScreen(true);

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf'));
    });

    expect(readMock).toHaveBeenCalledWith(SYLLABUS);
    expect(screen.getByTestId('draft-title-1').props.value).toBe('Sprint 1 review');
    expect(screen.getByTestId('syllabus-input').props.value).toBe(SYLLABUS); // the text stays visible
  });
});

/** A reading that has not finished yet, and the way to finish it or fail it. */
function pending() {
  let finish: (reading: AiReading) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<AiReading>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

describe('a reading that finishes after the student has moved on', () => {
  it('drops a late answer for the course the student left, and ends the wait', async () => {
    const slow = pending();
    readMock.mockReturnValue(slow.promise);
    await renderScreen(true);
    fireEvent.changeText(screen.getByTestId('syllabus-input'), SYLLABUS);
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-find'));
    });
    expect(screen.getByTestId('syllabus-ai-wait')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(`Choose ${wallSemester.courses[1].code}`));
    expect(screen.queryByTestId('syllabus-ai-wait')).toBeNull(); // the wait belonged to the old course
    await act(async () => slow.finish(READING));

    expect(screen.queryByTestId('draft-title-0')).toBeNull(); // nothing from CS 262 under MATH 251
    expect(screen.queryByTestId('syllabus-add')).toBeNull();
    expect(screen.getByTestId('syllabus-find').props.accessibilityState.disabled).toBe(false);
  });

  it('drops a late failure too: no note and no scanner result for the course the student left', async () => {
    const slow = pending();
    readMock.mockReturnValue(slow.promise);
    await renderScreen(true);
    await pasteAndFind('Week 4: Lab report (3 hours)');

    fireEvent.press(screen.getByLabelText(`Choose ${wallSemester.courses[1].code}`));
    await act(async () => slow.fail(new Error('The AI service could not be reached.')));

    expect(screen.queryByTestId('syllabus-ai-note')).toBeNull();
    expect(screen.queryByTestId('draft-title-0')).toBeNull();
  });

  it('adds a reading made after a course change to the new course, not the old one', async () => {
    const slow = pending();
    readMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(READING);
    (addTasksMock as jest.Mock).mockResolvedValue([]);
    await renderScreen(true);
    await pasteAndFind();
    fireEvent.press(screen.getByLabelText(`Choose ${wallSemester.courses[1].code}`));
    await pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-week-2'), '8');

    await act(async () => slow.finish({ ...READING, assignments: [{ title: 'CS only', dueWeek: 1, estimatedHours: 1 }] }));
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-add'));
    });

    expect(screen.queryByDisplayValue('CS only')).toBeNull();
    expect(addTasksMock).toHaveBeenCalledTimes(1);
    const posted = addTasksMock.mock.calls[0][0] as { courseId: string; title: string }[];
    expect(posted.every((t) => t.courseId === wallSemester.courses[1].id)).toBe(true);
    expect(posted.map((t) => t.title)).not.toContain('CS only');
  });

  it('keeps a newer PDF reading when an older pasted reading finishes after it', async () => {
    const older = pending();
    const newer: AiReading = { ...READING, assignments: [{ title: 'From the PDF', dueWeek: 2, estimatedHours: 3 }] };
    readMock.mockReturnValueOnce(older.promise).mockResolvedValueOnce(newer);
    pickPdfMock.mockResolvedValue(new Blob(['%PDF-1.7']));
    extractMock.mockResolvedValue({ text: 'PDF TEXT', pageCount: 1, lineCount: 1, pagesWithoutText: [] });
    await renderScreen(true);
    await pasteAndFind('pasted text');

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf'));
    });
    expect(screen.getByTestId('draft-title-0').props.value).toBe('From the PDF');

    await act(async () => older.finish(READING)); // arrives late

    expect(screen.getByTestId('draft-title-0').props.value).toBe('From the PDF');
    expect(screen.getByTestId('syllabus-input').props.value).toBe('PDF TEXT'); // still matches the boxes
    expect(screen.getByTestId('syllabus-find').props.accessibilityState.disabled).toBe(false);
  });

  it('keeps the wait going when an older reading finishes while a newer one is still running', async () => {
    const older = pending();
    const newer = pending();
    readMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    pickPdfMock.mockResolvedValue(new Blob(['%PDF-1.7']));
    extractMock.mockResolvedValue({ text: 'PDF TEXT', pageCount: 1, lineCount: 1, pagesWithoutText: [] });
    await renderScreen(true);
    await pasteAndFind('pasted text');
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf'));
    });

    await act(async () => older.finish(READING));
    expect(screen.getByTestId('syllabus-ai-wait')).toBeTruthy(); // the newer reading still owns it
    expect(screen.queryByTestId('draft-title-0')).toBeNull();

    await act(async () => newer.finish(READING));
    expect(screen.queryByTestId('syllabus-ai-wait')).toBeNull();
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Prototype demo');
  });

  it('drops a PDF that finished extracting after the course changed', async () => {
    let extracted: (value: Awaited<ReturnType<typeof extractSyllabusText>>) => void = () => {};
    extractMock.mockReturnValue(new Promise((resolve) => (extracted = resolve)));
    pickPdfMock.mockResolvedValue(new Blob(['%PDF-1.7']));
    await renderScreen(true);
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf'));
    });

    fireEvent.press(screen.getByLabelText(`Choose ${wallSemester.courses[1].code}`));
    await act(async () => extracted({ text: SYLLABUS, pageCount: 1, lineCount: 3, pagesWithoutText: [] }));

    expect(readMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('draft-title-0')).toBeNull();
    expect(screen.getByTestId('syllabus-pdf').props.accessibilityState.disabled).toBe(false);
  });

  it('drops a PDF picked after the course changed while the picker was open', async () => {
    let picked: (blob: Blob | null) => void = () => {};
    pickPdfMock.mockReturnValue(new Promise((resolve) => (picked = resolve)));
    extractMock.mockResolvedValue({ text: SYLLABUS, pageCount: 1, lineCount: 3, pagesWithoutText: [] });
    readMock.mockResolvedValue(READING);
    await renderScreen(true);
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf')); // the picker opens and stays open
    });

    fireEvent.press(screen.getByLabelText(`Choose ${wallSemester.courses[1].code}`));
    await act(async () => picked(new Blob(['%PDF-1.7'])));

    expect(extractMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('draft-title-0')).toBeNull();
    expect(screen.getByTestId('syllabus-input').props.value).toBe('');
  });

  it('does not stop a reading in progress when the picker is cancelled', async () => {
    const slow = pending();
    readMock.mockReturnValue(slow.promise);
    pickPdfMock.mockResolvedValue(null);
    await renderScreen(true);
    await pasteAndFind();

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf')); // cancelled at once
    });
    expect(screen.getByTestId('syllabus-ai-wait')).toBeTruthy();

    await act(async () => slow.finish(READING));
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Prototype demo');
  });

  it('keeps "Reading the PDF" while a newer PDF is still being read, when an older PDF finishes its AI wait', async () => {
    const olderAi = pending();
    let extractedSecond: (value: Awaited<ReturnType<typeof extractSyllabusText>>) => void = () => {};
    pickPdfMock.mockResolvedValue(new Blob(['%PDF-1.7']));
    extractMock
      .mockResolvedValueOnce({ text: 'FIRST', pageCount: 1, lineCount: 1, pagesWithoutText: [] })
      .mockReturnValueOnce(new Promise((resolve) => (extractedSecond = resolve)));
    readMock.mockReturnValueOnce(olderAi.promise).mockResolvedValueOnce(READING);
    await renderScreen(true);

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf')); // PDF 1: extracted, now waiting on the AI
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-pdf')); // PDF 2: its extraction stays pending
    });
    expect(screen.getByTestId('syllabus-pdf').props.accessibilityState.disabled).toBe(true);

    await act(async () => olderAi.finish(READING)); // PDF 1 is now stale and finishes

    expect(screen.getByTestId('syllabus-pdf').props.accessibilityState.disabled).toBe(true); // still PDF 2's
    expect(screen.getAllByText('Reading the PDF…').length).toBeGreaterThan(0);

    await act(async () => extractedSecond({ text: 'SECOND', pageCount: 1, lineCount: 1, pagesWithoutText: [] }));
    expect(screen.getByTestId('syllabus-pdf').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('syllabus-input').props.value).toBe('SECOND');
  });

  it('will not add while a newer reading is about to replace the boxes', async () => {
    const second = pending();
    readMock.mockResolvedValueOnce(READING).mockReturnValueOnce(second.promise);
    await renderScreen(true);
    await pasteAndFind();
    fireEvent.changeText(screen.getByTestId('draft-week-2'), '8');

    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-find'));
    });

    expect(screen.getByTestId('syllabus-add').props.accessibilityState.disabled).toBe(true);
    await act(async () => {
      fireEvent.press(screen.getByTestId('syllabus-add'));
    });
    expect(addTasksMock).not.toHaveBeenCalled();
  });
});

describe('a partial reading', () => {
  it('warns that the list may be incomplete when the server dropped items', async () => {
    readMock.mockResolvedValue({ ...READING, dropped: 3 });
    await renderScreen(true);
    await pasteAndFind();

    expect(screen.getByTestId('syllabus-ai-partial')).toBeTruthy();
    expect(screen.getByText(/3 items in the AI's answer could not be used/)).toBeTruthy();
  });

  it('says "1 item" for one, and shows no warning when nothing was dropped', async () => {
    readMock.mockResolvedValueOnce({ ...READING, dropped: 1 });
    await renderScreen(true);
    await pasteAndFind();
    expect(screen.getByText(/^1 item in the AI's answer/)).toBeTruthy();

    readMock.mockResolvedValueOnce({ ...READING, dropped: 0 });
    await pasteAndFind();
    expect(screen.queryByTestId('syllabus-ai-partial')).toBeNull();
  });
});

describe('without an AI on the server', () => {
  it('uses the simple scanner and never calls the AI', async () => {
    await renderScreen(false);

    await pasteAndFind('Week 4: Lab report (3 hours)');

    expect(readMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('draft-title-0').props.value).toBe('Lab report');
    expect(screen.queryByTestId('syllabus-ai-note')).toBeNull();
  });
});


describe('course and duplicate review hints', () => {
  it('warns for the wrong course and clears after choosing the mentioned course and finding again', async () => {
    await renderScreen(false);
    fireEvent.press(screen.getByLabelText('Choose MATH 251'));
    await pasteAndFind('CS-262\nWeek 4: Lab report');
    expect(screen.getByTestId('syllabus-course-warning').props.children).toBe(
      'This syllabus mentions CS 262, but MATH 251 is chosen. Check the course before adding.'
    );
    fireEvent.press(screen.getByLabelText('Choose CS 262'));
    expect(screen.queryByTestId('syllabus-course-warning')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByTestId('syllabus-find')); });
    expect(screen.queryByTestId('syllabus-course-warning')).toBeNull();
  });
  it('keeps the wrong-course warning non-blocking on Add', async () => {
    await renderScreen(false);
    await pasteAndFind('MATH 251\nWeek 4: Lab report');
    expect(screen.getByTestId('syllabus-course-warning')).toBeTruthy();
    addTasksMock.mockResolvedValue([]);
    await act(async () => { fireEvent.press(screen.getByTestId('syllabus-add')); });
    expect(addTasksMock).toHaveBeenCalledWith([
      { courseId: 'c1', title: 'Lab report', dueWeek: 4, estimatedHours: null },
    ]);
  });
  it('shows duplicate hints for AI drafts, recomputes edits, and still adds duplicates', async () => {
    readMock.mockResolvedValue({ ...READING, assignments: [{ title: 'Big project', dueWeek: 6, estimatedHours: 20 }] });
    await renderScreen(true);
    await pasteAndFind();
    expect(screen.getByTestId('draft-duplicate-hint-0').props.children).toBe(
      'Already in your semester for CS 262, week 6.'
    );
    fireEvent.changeText(screen.getByTestId('draft-title-0'), 'Other project');
    expect(screen.queryByTestId('draft-duplicate-hint-0')).toBeNull();
    fireEvent.changeText(screen.getByTestId('draft-title-0'), ' BIG PROJECT ');
    expect(screen.getByTestId('draft-duplicate-hint-0')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '7');
    expect(screen.queryByTestId('draft-duplicate-hint-0')).toBeNull();
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '');
    expect(screen.queryByTestId('draft-duplicate-hint-0')).toBeNull();
    fireEvent.changeText(screen.getByTestId('draft-week-0'), '6');
    expect(screen.getByTestId('draft-duplicate-hint-0')).toBeTruthy();
    addTasksMock.mockResolvedValue([]);
    await act(async () => { fireEvent.press(screen.getByTestId('syllabus-add')); });
    expect(addTasksMock).toHaveBeenCalledWith([
      { courseId: 'c1', title: 'BIG PROJECT', dueWeek: 6, estimatedHours: 20 },
    ]);
  });
  it('shows the duplicate hint for a scanner draft and lets the student remove it', async () => {
    await renderScreen(false);
    await pasteAndFind('Week 6: Big project');
    expect(screen.getByTestId('draft-duplicate-hint-0')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Remove Big project'));
    expect(screen.queryByTestId('draft-duplicate-hint-0')).toBeNull();
  });
});
