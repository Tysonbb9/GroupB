/** The fixed set of assignment categories. Must match client/src/lib/categories.ts. */
export type Category =
  | 'exam'
  | 'project'
  | 'problemSet'
  | 'reading'
  | 'writing'
  | 'homework';
/**
 * The whole data model. If a field is not used by a function in lib/
 * or drawn on a screen in app/, it does not belong here yet.
 */

export type Task = {
  id: string;
  courseId: string;
  title: string;
  /**
   * What kind of work this is. Undefined means it could not be classified,
   * which is not a failure: the task shows a neutral tile and sorts normally.
   */
  category?: Category;
  /** Week of the semester the task is due, 1-15. */
  dueWeek: number;
  /** How long we think it takes. null means nobody has estimated it. */
  estimatedHours: number | null;
  /**
   * How many weeks the work is spread across, ending at dueWeek.
   * A 12-hour project with spreadWeeks: 3 puts 4 hours in each of
   * the three weeks up to and including its due week. Defaults to 1.
   */
  spreadWeeks?: number;
  done: boolean;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  /** null when the syllabus has no attendance policy. */
  attendance: { allowed: number; used: number } | null;
};

export type Semester = {
  label: string;
  /** Which week we are in right now, 1-15. */
  currentWeek: number;
  /** Hours per week the student says they have for school. */
  weeklyCapacity: number;
  courses: Course[];
  tasks: Task[];
};

/** Projected hours of remaining work in one week. */
export type WeekLoad = {
  week: number;
  hours: number;
};

/** A run of consecutive weeks that are over capacity. */
export type CrunchWindow = {
  startWeek: number;
  endWeek: number;
  peakHours: number;
};

/** Weeks in a semester. Fixed for now; real dates arrive in phase 2. */
export const WEEKS_IN_SEMESTER = 15;
/**
 * US-22: one student's report of how long an assignment took them.
 * Same fields as CrowdReport in client/src/lib/inputs.ts (US-24), so the
 * crowd estimate can use reviews as they are.
 */
export type Review = {
  id: string;
  courseId: string;
  /** The assignment, as its title appears in the syllabus. */
  title: string;
  hours: number;
  comment: string;
};

/** US-22: everything the student has handed us, kept apart from the semester. */
export type Inputs = {
  /** Moodle calendar subscription URL, or null if none was given. */
  calendarUrl: string | null;
  reviews: Review[];
};