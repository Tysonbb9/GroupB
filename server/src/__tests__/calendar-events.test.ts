import { parseIcs, parseIcsDate, type CalendarEvent } from '../calendar/ics';
import { buildProposals, matchCourse, semesterStart, taskTitle, weekOf } from '../calendar/proposals';

/**
 * US-49 (#165): reading a Moodle calendar and turning its events into tasks
 * to review. The calendar below is shaped like Moodle's export: CRLF lines,
 * a folded long line, escaped text, and the course in CATEGORIES.
 */

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Moodle Pty Ltd//NONSGML Moodle Version 2024100700//EN',
  'BEGIN:VEVENT',
  'UID:101@moodle.calvin.edu',
  'SUMMARY:Lab 3 is due',
  'DTSTART:20261007T055900Z',
  'CATEGORIES:CS262-A FA26',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:102@moodle.calvin.edu',
  'SUMMARY:Problem set 4\\, parts A and B',
  'DTSTART;VALUE=DATE:20261020',
  'CATEGORIES:MATH251-B FA26',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:103@moodle.calvin.edu',
  'SUMMARY:A very long title that Moodle folds onto a',
  '  second line',
  'DTSTART;TZID=America/Detroit:20261103T235900',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:No id, so skipped',
  'DTSTART:20261007T055900Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:105@moodle.calvin.edu',
  'SUMMARY:No date, so skipped',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

describe('parseIcsDate', () => {
  it.each([
    ['20261007T055900Z', '2026-10-07T05:59:00.000Z'],
    ['20261103T235900', '2026-11-03T23:59:00.000Z'],
    ['20261020', '2026-10-20T00:00:00.000Z'],
  ])('reads %s', (value, iso) => {
    expect(parseIcsDate(value)?.toISOString()).toBe(iso);
  });

  it.each(['', 'tomorrow', '2026-10-20', '20261320', '20260231', '20261007T256000Z'])('refuses %p', (value) => {
    expect(parseIcsDate(value)).toBeNull();
  });
});

describe('parseIcs', () => {
  const events = parseIcs(ICS);

  it('reads every event that has an id, a title and a date, and skips the rest', () => {
    expect(events.map((e) => e.uid)).toEqual(['101@moodle.calvin.edu', '102@moodle.calvin.edu', '103@moodle.calvin.edu']);
  });

  it('reads the title, the date and the course', () => {
    expect(events[0]).toEqual({
      uid: '101@moodle.calvin.edu',
      title: 'Lab 3 is due',
      start: new Date('2026-10-07T05:59:00Z'),
      categories: ['CS262-A FA26'],
    });
  });

  it('undoes escaped commas', () => {
    expect(events[1].title).toBe('Problem set 4, parts A and B');
  });

  it('joins a folded line back together', () => {
    expect(events[2].title).toBe('A very long title that Moodle folds onto a second line');
  });

  it('reads plain LF line endings too', () => {
    expect(parseIcs(ICS.replace(/\r\n/g, '\n'))).toHaveLength(3);
  });

  it('reads nothing from a calendar with no events', () => {
    expect(parseIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')).toEqual([]);
  });

  it('splits several categories', () => {
    const [event] = parseIcs('BEGIN:VEVENT\nUID:1\nSUMMARY:x\nDTSTART:20261007\nCATEGORIES:CS262,Team\nEND:VEVENT');
    expect(event.categories).toEqual(['CS262', 'Team']);
  });
});

describe('weeks', () => {
  // Monday 16 November 2026 is in week 3, so week 1 began on Monday 2 November.
  const today = new Date('2026-11-18T15:00:00Z');

  it('counts week 1 back from the week it is now', () => {
    expect(semesterStart(3, today).toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('treats a Sunday as the end of its week', () => {
    expect(semesterStart(3, new Date('2026-11-22T23:00:00Z')).toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('puts a moment in its semester week', () => {
    const start = semesterStart(3, today);
    expect(weekOf(new Date('2026-11-02T00:00:00Z'), start)).toBe(1);
    expect(weekOf(new Date('2026-11-08T23:59:00Z'), start)).toBe(1);
    expect(weekOf(new Date('2026-11-09T00:00:00Z'), start)).toBe(2);
    expect(weekOf(new Date('2027-02-14T12:00:00Z'), start)).toBe(15);
  });

  it('is null before week 1 or after week 15', () => {
    const start = semesterStart(3, today);
    expect(weekOf(new Date('2026-11-01T23:00:00Z'), start)).toBeNull();
    expect(weekOf(new Date('2027-02-15T00:00:00Z'), start)).toBeNull();
  });
});

describe('matchCourse', () => {
  const courses = [
    { id: 'cs262', code: 'CS 262' },
    { id: 'math251', code: 'MATH 251' },
    { id: 'cs26', code: 'CS 26' },
  ];
  const event = (categories: string[], title = 'Lab') => ({ uid: 'x', title, start: new Date(), categories });

  it("matches Moodle's short name in CATEGORIES, whatever its spacing", () => {
    expect(matchCourse(event(['CS262-A FA26']), courses)).toBe('cs262');
    expect(matchCourse(event(['math 251 b']), courses)).toBe('math251');
  });

  it('does not let a shorter code match a longer one (CS 26 is not CS 262)', () => {
    expect(matchCourse(event(['CS262-A']), courses)).toBe('cs262');
    expect(matchCourse(event(['CS26-B']), courses)).toBe('cs26');
  });

  it('falls back to the title when CATEGORIES names no course', () => {
    expect(matchCourse(event([], 'MATH 251: Quiz 2 is due'), courses)).toBe('math251');
  });

  it('is null when nothing matches, so the student places it', () => {
    expect(matchCourse(event(['PHIL153']), courses)).toBeNull();
  });

  it('is null when two courses match, rather than guessing', () => {
    expect(matchCourse(event(['CS262 and MATH251 joint review']), courses)).toBeNull();
  });
});

describe('taskTitle', () => {
  it.each([
    ['Lab 3 is due', 'Lab 3'],
    ['Lab 3 due', 'Lab 3'],
    ['Essay 1 is due.', 'Essay 1'],
    ['Midterm 1', 'Midterm 1'],
    ['due', 'due'],
  ])('%p becomes %p', (eventTitle, title) => {
    expect(taskTitle(eventTitle)).toBe(title);
  });
});

describe('buildProposals', () => {
  const start = new Date('2026-09-01T00:00:00Z'); // a Tuesday is fine: weeks count from here
  const courses = [
    { id: 'cs262', code: 'CS 262' },
    { id: 'math251', code: 'MATH 251' },
  ];
  const at = (iso: string) => new Date(iso);
  const ev = (uid: string, title: string, iso: string, categories: string[] = []): CalendarEvent => ({
    uid,
    title,
    start: at(iso),
    categories,
  });
  const events = [
    ev('b', 'Lab 3 is due', '2026-09-20T10:00:00Z', ['CS262-A']), // week 3
    ev('a', 'Quiz 1 is due', '2026-09-03T10:00:00Z', ['MATH251']), // week 1
    ev('c', 'Club meeting', '2026-09-10T10:00:00Z'), // week 2, no course
    ev('d', 'Old', '2026-08-20T10:00:00Z', ['CS262']), // before week 1
    ev('e', 'Finals party', '2027-01-30T10:00:00Z', ['CS262']), // after week 15
  ];

  it('proposes each event as a task, soonest first, with its week and course', () => {
    const result = buildProposals(events, courses, [], new Set(), start);
    expect(result.proposals).toEqual([
      { eventId: 'a', title: 'Quiz 1', dueWeek: 1, courseId: 'math251', alreadyInSemester: false },
      { eventId: 'c', title: 'Club meeting', dueWeek: 2, courseId: null, alreadyInSemester: false },
      { eventId: 'b', title: 'Lab 3', dueWeek: 3, courseId: 'cs262', alreadyInSemester: false },
    ]);
  });

  it('counts the events outside weeks 1 to 15 instead of proposing them', () => {
    expect(buildProposals(events, courses, [], new Set(), start).outsideSemester).toBe(2);
  });

  it('leaves out events added before, and counts them', () => {
    const result = buildProposals(events, courses, [], new Set(['a', 'b']), start);
    expect(result.proposals.map((p) => p.eventId)).toEqual(['c']);
    expect(result.alreadyAdded).toBe(2);
  });

  it('marks an event the syllabus already added (same course, title and week)', () => {
    const tasks = [{ courseId: 'cs262', title: 'lab 3', dueWeek: 3 }];
    const lab = buildProposals(events, courses, tasks, new Set(), start).proposals.find((p) => p.eventId === 'b');
    expect(lab?.alreadyInSemester).toBe(true);
  });

  it('does not mark one in another week or course', () => {
    const tasks = [
      { courseId: 'cs262', title: 'Lab 3', dueWeek: 4 },
      { courseId: 'math251', title: 'Lab 3', dueWeek: 3 },
    ];
    const lab = buildProposals(events, courses, tasks, new Set(), start).proposals.find((p) => p.eventId === 'b');
    expect(lab?.alreadyInSemester).toBe(false);
  });

  it('proposes an event only once when the file repeats it', () => {
    const twice = [events[0], events[0]];
    expect(buildProposals(twice, courses, [], new Set(), start).proposals).toHaveLength(1);
  });
});
