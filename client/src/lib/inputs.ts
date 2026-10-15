import { MAX_ESTIMATE_HOURS, parseEstimate } from './estimate';
import { CrunchWindow, Semester, Task, WeekLoad, WEEKS_IN_SEMESTER } from './types';
import { detectCrunch, weeklyLoad } from './workload';

/**
 * US-24: process the inputs a student hands over.
 *
 * Three steps, each a pure function:
 *
 *   1. scan a syllabus for assignments            (scanSyllabus)
 *   2. fill in missing estimates from the crowd   (applyCrowdEstimates)
 *   3. run the workload calculations over the lot (processInputs)
 *
 * No network, no model, no React. The scanner reads plain text in one fixed
 * format; reading real PDFs and photos is a later phase. What this settles is
 * what happens to the inputs once they are text.
 */

/** Fewest usable crowd reports before we trust them. Below this, no estimate. */
export const MIN_CROWD_REPORTS = 3;

/** An assignment read off a syllabus. It has no id until it joins a semester. */
export type ScannedTask = Omit<Task, 'id'>;

export type ScanResult = {
  tasks: ScannedTask[];
  /** Non-blank lines that did not read as an assignment, exactly as trimmed. */
  skipped: string[];
};

/**
 * "Week 7: Midterm 1 (8 hours)". An optional bullet may come first, and the
 * separator after the week may be a colon or a dash. A week range such as
 * "Week 5-7" is not understood, so it is skipped rather than guessed at.
 */
const SYLLABUS_LINE = /^(?:[-*•]\s*)?week\s+(\d{1,3})(?!\d|[-–—]\d)\s*[:\-–—]?\s*(.*)$/i;

/** A trailing "(8 hours)", "(2.5 hrs)" or "(3h)". */
const TRAILING_HOURS = /\(\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*\)\s*$/i;

/**
 * Read assignments out of syllabus text, one per line.
 *
 * A line becomes an assignment when it names a week from 1 to 15 and has a
 * title. Hours are taken from a trailing "(N hours)" when they are a usable
 * estimate; otherwise the assignment is kept with no estimate, never a guess.
 */
export function scanSyllabus(text: string, courseId: string): ScanResult {
  const tasks: ScannedTask[] = [];
  const skipped: string[] = [];

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    const scanned = scanLine(line, courseId);
    if (scanned === null) skipped.push(line);
    else tasks.push(scanned);
  }

  return { tasks, skipped };
}

function scanLine(line: string, courseId: string): ScannedTask | null {
  const match = SYLLABUS_LINE.exec(line);
  if (match === null) return null;

  const dueWeek = Number(match[1]);
  if (dueWeek < 1 || dueWeek > WEEKS_IN_SEMESTER) return null;

  let title = match[2].trim();
  let estimatedHours: number | null = null;

  const hours = TRAILING_HOURS.exec(title);
  if (hours !== null) {
    const parsed = parseEstimate(hours[1]);
    // An unusable figure such as "(500 hours)" stays in the title, visible,
    // instead of being quietly dropped or quietly believed.
    if (parsed.ok && parsed.hours !== null) {
      estimatedHours = parsed.hours;
      title = title.slice(0, hours.index).trim();
    }
  }

  if (title === '') return null;

  return { courseId, title, dueWeek, estimatedHours, done: false };
}

/** One student's report of how long an assignment took them. */
export type CrowdReport = { courseId: string; title: string; hours: number };

/**
 * What the crowd says an assignment takes: the median of the usable reports,
 * or null when there are fewer than MIN_CROWD_REPORTS of them.
 *
 * A usable report is a finite number above zero and no larger than
 * MAX_ESTIMATE_HOURS. The median, not the mean, so one student who typed 90
 * for a 3-hour reading does not drag everyone else's estimate with them.
 */
export function crowdEstimate(hours: number[]): number | null {
  const usable = hours
    .filter((h) => Number.isFinite(h) && h > 0 && h <= MAX_ESTIMATE_HOURS)
    .sort((a, b) => a - b);

  if (usable.length < MIN_CROWD_REPORTS) return null;

  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 1
    ? usable[middle]
    : (usable[middle - 1] + usable[middle]) / 2;
}

/** Same assignment, whatever the capitalisation or spacing. */
function assignmentKey(courseId: string, title: string): string {
  return `${courseId}\u0000${title.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** Same assignment in the same week: what makes a scanned line a duplicate. */
function duplicateKey(courseId: string, title: string, dueWeek: number): string {
  return `${assignmentKey(courseId, title)}\u0000${dueWeek}`;
}

/**
 * Give unestimated tasks the crowd's estimate where there is enough data.
 *
 * A student's own estimate always wins and is never replaced, and a task
 * without enough reports stays unestimated. Returns new tasks and leaves the
 * originals untouched.
 */
export function applyCrowdEstimates(tasks: Task[], reports: CrowdReport[]): Task[] {
  // A Map rather than an object, so a title like "constructor" is just a title.
  const hoursByAssignment = new Map<string, number[]>();
  for (const report of reports) {
    const key = assignmentKey(report.courseId, report.title);
    const list = hoursByAssignment.get(key);
    if (list === undefined) hoursByAssignment.set(key, [report.hours]);
    else list.push(report.hours);
  }

  return tasks.map((task) => {
    if (task.estimatedHours !== null) return task;

    const estimate = crowdEstimate(
      hoursByAssignment.get(assignmentKey(task.courseId, task.title)) ?? []
    );
    return estimate === null ? task : { ...task, estimatedHours: estimate };
  });
}

/** Everything the student hands over, as text and reports. */
export type Inputs = {
  syllabi?: { courseId: string; text: string }[];
  crowdReports?: CrowdReport[];
};

export type SkippedLine = {
  courseId: string;
  line: string;
  /** Not an assignment we could read, or one the semester already has. */
  reason: 'unrecognised' | 'duplicate';
};

export type ProcessedInputs = {
  /** The semester's tasks plus everything newly scanned, crowd estimates applied. */
  tasks: Task[];
  skipped: SkippedLine[];
  /** Syllabi given for a course the semester does not have. Nothing is added for them. */
  unknownCourses: string[];
  loads: WeekLoad[];
  crunch: CrunchWindow[];
};

/**
 * Process a student's inputs against their semester.
 *
 * Scans each syllabus, adds the assignments the semester does not already
 * have, applies crowd estimates to anything still unestimated, then
 * recomputes the weekly load and the crunch windows. Pure: the semester that
 * is passed in is not changed.
 */
export function processInputs(semester: Semester, inputs: Inputs = {}): ProcessedInputs {
  const { syllabi = [], crowdReports = [] } = inputs;

  const courseIds = new Set(semester.courses.map((c) => c.id));
  const takenIds = new Set(semester.tasks.map((t) => t.id));
  const seen = new Set(
    semester.tasks.map((t) => duplicateKey(t.courseId, t.title, t.dueWeek))
  );

  const added: Task[] = [];
  const skipped: SkippedLine[] = [];
  const unknownCourses: string[] = [];

  for (const syllabus of syllabi) {
    if (!courseIds.has(syllabus.courseId)) {
      if (!unknownCourses.includes(syllabus.courseId)) {
        unknownCourses.push(syllabus.courseId);
      }
      continue;
    }

    const scan = scanSyllabus(syllabus.text, syllabus.courseId);
    for (const line of scan.skipped) {
      skipped.push({ courseId: syllabus.courseId, line, reason: 'unrecognised' });
    }

    for (const scanned of scan.tasks) {
      const key = duplicateKey(scanned.courseId, scanned.title, scanned.dueWeek);
      if (seen.has(key)) {
        skipped.push({
          courseId: scanned.courseId,
          line: `Week ${scanned.dueWeek}: ${scanned.title}`,
          reason: 'duplicate',
        });
        continue;
      }
      seen.add(key);

      const id = nextId(scanned.courseId, takenIds);
      takenIds.add(id);
      added.push({ ...scanned, id });
    }
  }

  const tasks = applyCrowdEstimates([...semester.tasks, ...added], crowdReports);
  const loads = weeklyLoad(tasks);

  return {
    tasks,
    skipped,
    unknownCourses,
    loads,
    crunch: detectCrunch(loads, semester.weeklyCapacity),
  };
}

/** The first "<course>-syl-N" nobody is using, so ids stay unique across runs. */
function nextId(courseId: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${courseId}-syl-${n}`)) n++;
  return `${courseId}-syl-${n}`;
}
