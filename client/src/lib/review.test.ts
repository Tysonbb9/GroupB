import { checkDraft, Draft, toDraft } from './review';

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