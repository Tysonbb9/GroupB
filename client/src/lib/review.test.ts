import { checkDraft, courseMentioned, Draft, fromReading, isDuplicate, toDraft } from './review';

/** US-30: checking an assignment the student has reviewed. Pure, no screen. */

const good: Draft = { title: 'Lab report', week: '4', hours: '3' };

describe('toDraft', () => {
  it('fills the boxes with what the scanner found', () => {
    const draft = toDraft({ courseId: 'c1', title: 'Lab report', dueWeek: 4, estimatedHours: 3, done: false });
    expect(draft).toEqual({ title: 'Lab report', week: '4', hours: '3' });
  });

  it('leaves the hours box empty when there is no estimate', () => {
    const draft = toDraft({ courseId: 'c1', title: 'Quiz', dueWeek: 9, estimatedHours: null, done: false });
    expect(draft.hours).toBe('');
  });
});

describe('fromReading (issue #145)', () => {
  it('fills the boxes with what the AI read', () => {
    expect(fromReading({ title: 'Prototype demo', dueWeek: 4, estimatedHours: 6 })).toEqual({
      title: 'Prototype demo',
      week: '4',
      hours: '6',
    });
  });

  it('leaves a week or hours the AI did not find empty, never guessed', () => {
    expect(fromReading({ title: 'Weekly quizzes', dueWeek: null, estimatedHours: null })).toEqual({
      title: 'Weekly quizzes',
      week: '',
      hours: '',
    });
  });

  it('gives a draft that checkDraft refuses until the week is filled in', () => {
    const draft = fromReading({ title: 'Weekly quizzes', dueWeek: null, estimatedHours: null });
    expect(checkDraft(draft).ok).toBe(false);
    expect(checkDraft({ ...draft, week: '8' }).ok).toBe(true); // blank hours are fine
  });
});

describe('checkDraft', () => {
  it('accepts a valid assignment and turns the text into numbers', () => {
    expect(checkDraft(good)).toEqual({
      ok: true,
      value: { title: 'Lab report', dueWeek: 4, estimatedHours: 3 },
    });
  });

  it('trims the title', () => {
    const checked = checkDraft({ ...good, title: '  Lab report  ' });
    expect(checked.ok && checked.value.title).toBe('Lab report');
  });

  it('accepts blank hours as "no estimate"', () => {
    const checked = checkDraft({ ...good, hours: '' });
    expect(checked.ok && checked.value.estimatedHours).toBeNull();
  });

  it.each(['1', '15'])('accepts week %s', (week) => {
    expect(checkDraft({ ...good, week }).ok).toBe(true);
  });

  it.each(['', '0', '16', '4.5', '-1', 'four'])('rejects week "%s"', (week) => {
    expect(checkDraft({ ...good, week })).toEqual({
      ok: false,
      error: 'The week must be a whole number from 1 to 15.',
    });
  });

  it.each(['0', '101', '-2', 'lots'])('rejects hours "%s"', (hours) => {
    expect(checkDraft({ ...good, hours })).toEqual({
      ok: false,
      error: 'Hours must be more than 0 and up to 100, or left blank.',
    });
  });

  it('rejects a blank title', () => {
    expect(checkDraft({ ...good, title: '   ' })).toEqual({
      ok: false,
      error: 'Give the assignment a title.',
    });
  });
});

describe('courseMentioned', () => {
  const courses = [
    { id: 'short', code: 'CS 26' },
    { id: 'cs', code: 'CS 262' },
    { id: 'math', code: 'MATH 251' },
  ];
  it.each(['CS 262', 'cs262', 'CS-262'])('matches a whole course code in %s', (text) => {
    expect(courseMentioned(`Syllabus for ${text}.`, courses, 'math')).toBe('CS 262');
  });
  it.each(['XCS 262', 'CS 2620', 'CS 262A'])('does not match part of %s', (text) => {
    expect(courseMentioned(text, courses, 'math')).toBeNull();
  });
  it('stays silent when the chosen course is mentioned too', () => {
    expect(courseMentioned('CS262 and MATH251', courses, 'math')).toBeNull();
  });
  it('stays silent when several other courses are mentioned', () => {
    expect(courseMentioned('CS26 and CS262', courses, 'math')).toBeNull();
  });
  it('stays silent when no course is mentioned', () => {
    expect(courseMentioned('Weekly homework', courses, 'math')).toBeNull();
  });
});

describe('isDuplicate', () => {
  const tasks = [{ courseId: 'c1', title: 'Lab report', dueWeek: 4 }];
  it('matches trimmed case-insensitive titles in the same course and week', () => {
    expect(isDuplicate({ ...good, title: ' LAB REPORT ' }, tasks, 'c1')).toBe(true);
  });
  it.each([
    { ...good, title: 'Other report' },
    { ...good, week: '5' },
    { ...good, week: '' },
    { ...good, week: ' ' },
  ])('does not flag a different title, week, or blank week: %j', (draft) => {
    expect(isDuplicate(draft, tasks, 'c1')).toBe(false);
  });
  it('does not flag a task in a different course', () => {
    expect(isDuplicate(good, tasks, 'c2')).toBe(false);
  });
});
