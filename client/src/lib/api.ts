import Constants from 'expo-constants';
import { Course, Semester, Task } from './types';

/**
 * Talking to the server. Everything the app knows about the outside world
 * goes through here, so the screens never call fetch themselves.
 */

const SERVER_PORT = 3000;

/**
 * Works out where the server lives.
 *
 *  1. EXPO_PUBLIC_API_URL, if it is set, always wins.
 *  2. While developing, use the address of the computer running Expo (the
 *     phone already knows it, because that is where it loaded the app from)
 *     with the server's port. This is what makes a phone work with no setup.
 *  3. In a release build there is nothing sensible to guess, so refuse.
 *     A release must never quietly talk to localhost.
 *
 * Takes its inputs as arguments so the rules can be tested without Expo.
 */
export function resolveBaseUrl({
  configured,
  hostUri,
  isDev,
}: {
  configured: string | undefined;
  /** Expo's "address:port" of the dev machine, when there is one. */
  hostUri: string | null | undefined;
  isDev: boolean;
}): string {
  if (configured) return configured.replace(/\/+$/, '');
  if (isDev) {
    const host = hostUri?.split(':')[0];
    return `http://${host || 'localhost'}:${SERVER_PORT}`;
  }
  throw new Error('The server address is not set (EXPO_PUBLIC_API_URL)');
}

/**
 * True for any non-null object. The return type Record<string, unknown> means
 * "an object with string keys whose values we know nothing about yet". That
 * is what lets the checks below read value.label and test its type, where
 * TypeScript would refuse to read any property of a plain unknown.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A shallow check that the server sent something shaped like a Semester.
 * It looks at the top-level fields only, not every task. That is enough to
 * catch the wrong URL or a server that answered with something else.
 */
function isSemester(value: unknown): value is Semester {
  return (
    isObject(value) &&
    typeof value.label === 'string' &&
    typeof value.currentWeek === 'number' &&
    typeof value.weeklyCapacity === 'number' &&
    Array.isArray(value.courses) &&
    Array.isArray(value.tasks)
  );
}

/** Where the server is, for this run of the app. */
export function serverBaseUrl(): string {
  return resolveBaseUrl({
    configured: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri,
    isDev: __DEV__,
  });
}

/** What a student sees when the server says their session has ended (401). */
export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please log in again.';

/**
 * How requests prove who is asking (US-20), set by the session while a
 * student is signed in with the server. Null in sample-data mode and in
 * tests, and then requests go out exactly as they did before accounts.
 */
export type RequestAuth = {
  /** Read again for every request, so a new sign-in is used straight away. */
  options: () => Promise<RequestInit>;
  /** Called when the server answers 401: the student has to log in again. */
  onSessionEnded: () => void;
  onResponse?: (response: Response, sent: RequestInit) => void;
};

let requestAuth: RequestAuth | null = null;

export function setRequestAuth(auth: RequestAuth | null): void {
  requestAuth = auth;
}

/**
 * Sends one request to our server, with the session added. Rejects with a
 * message the user can read when the server cannot be reached, or when it
 * says the session has ended. Every other answer is the caller's to check.
 */
async function send(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const baseUrl = serverBaseUrl();
  const auth = requestAuth;
  const extra = auth === null ? {} : await auth.options();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      ...extra,
      headers: { ...init.headers, ...(extra.headers as Record<string, string> | undefined) },
    });
  } catch {
    // fetch only rejects when it could not talk to the server at all.
    throw new Error(`Could not reach the server at ${baseUrl}`);
  }

  if (response.status === 401 && auth !== null) {
    auth.onSessionEnded();
    throw new Error(SESSION_ENDED_MESSAGE);
  }
  auth?.onResponse?.(response, extra);
  return response;
}

/** GET /semester. Rejects with a message the user can read. */
export async function fetchSemester(): Promise<Semester> {
  const response = await send('/semester');

  // fetch does not reject on an HTTP error status, so check it ourselves.
  if (!response.ok) {
    throw new Error(`The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isSemester(json)) {
    throw new Error('The server sent invalid semester data');
  }
  return json;
}

/** Loads the sample, or the semester already saved if another request got there first. */
export async function loadSampleSemester(): Promise<Semester> {
  const response = await send('/semester/sample', { method: 'POST' });
  if (response.status === 409) return fetchSemester();
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!isSemester(json)) throw new Error('The server sent invalid semester data');
  return json;
}

/**
 * PATCH /semester (US-32). Saves the hours the student has each week, and
 * returns the hours the server now holds. Rejects with a message the user
 * can read.
 */
export async function saveWeeklyCapacity(hours: number): Promise<number> {
  const response = await send(`/semester`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weeklyCapacity: hours }),
  });

  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isSemester(json)) {
    throw new Error('The server sent invalid semester data');
  }
  return json.weeklyCapacity;
}

/** The text the server read out of a syllabus PDF. */
export type SyllabusText = {
  /** Every line of the PDF in reading order, separated by "\n". */
  text: string;
  pageCount: number;
  lineCount: number;
  /** Pages with no text, numbered from 1. Usually scanned images. */
  pagesWithoutText: number[];
};

function isSyllabusText(value: unknown): value is SyllabusText {
  return (
    isObject(value) &&
    typeof value.text === 'string' &&
    typeof value.pageCount === 'number' &&
    typeof value.lineCount === 'number' &&
    Array.isArray(value.pagesWithoutText) &&
    value.pagesWithoutText.every((page) => typeof page === 'number')
  );
}

/** The server's own explanation of a failed request, if it sent one. */
async function serverErrorMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    return isObject(body) && typeof body.error === 'string' && body.error !== '' ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * POST /syllabus/text. Sends a syllabus PDF and gets its text back, one line
 * per line of the PDF, ready for the syllabus scanner from US-24.
 *
 * Rejects with a message the user can read. When the PDF itself is the
 * problem (scanned, locked, damaged, too big), that message is the server's,
 * because it says what to do about it: "try a PDF where you can select the
 * text, or paste the syllabus text instead".
 */
export async function extractSyllabusText(pdf: Blob | ArrayBuffer | Uint8Array): Promise<SyllabusText> {
  const response = await send(`/syllabus/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: pdf as BodyInit,
  });

  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isSyllabusText(json)) {
    throw new Error('The server sent invalid syllabus text');
  }
  return json;
}
/** An assignment the AI read in a syllabus. A week or hours it was not sure of are null. */
export type AiAssignment = {
  title: string;
  dueWeek: number | null;
  estimatedHours: number | null;
};

/** What the AI read in a syllabus, already checked by the server (issue #145). */
export type AiReading = {
  assignments: AiAssignment[];
  weights: { label: string; percent: number }[];
  policies: { absencesAllowed: number | null; dropRule: string | null };
  /** Items in the AI's answer the server threw away for not fitting. */
  dropped: number;
};

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || typeof value === 'number';

function isAiReading(value: unknown): value is AiReading {
  return (
    isObject(value) &&
    Array.isArray(value.assignments) &&
    value.assignments.every(
      (a) =>
        isObject(a) && typeof a.title === 'string' && isNumberOrNull(a.dueWeek) && isNumberOrNull(a.estimatedHours)
    ) &&
    Array.isArray(value.weights) &&
    value.weights.every((w) => isObject(w) && typeof w.label === 'string' && typeof w.percent === 'number') &&
    isObject(value.policies) &&
    isNumberOrNull(value.policies.absencesAllowed) &&
    (value.policies.dropRule === null || typeof value.policies.dropRule === 'string') &&
    typeof value.dropped === 'number'
  );
}

/**
 * GET /ai/status. True when the server has an AI to read syllabi with. Any
 * problem (no server, no session, an older server) counts as "no", so the
 * app falls back to its simple scanner and never shows an error for this.
 */
export async function getAiStatus(): Promise<boolean> {
  try {
    const response = await send('/ai/status');
    if (!response.ok) return false;
    const json: unknown = await response.json();
    return isObject(json) && json.available === true;
  } catch {
    return false;
  }
}

/**
 * POST /ai/syllabus. Sends syllabus text and gets back what the AI read in
 * it. This takes about 30 seconds, so the caller shows a waiting message.
 *
 * Rejects with a message the user can read. The server's own message is used
 * when it sent one, since it says what to do.
 */
export async function readSyllabusWithAi(text: string): Promise<AiReading> {
  const response = await send('/ai/syllabus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isAiReading(json)) {
    throw new Error('The server sent an invalid reading');
  }
  return json;
}

/** One assignment to add with POST /tasks. The server gives it its id. */
export type NewTask = {
  courseId: string;
  title: string;
  dueWeek: number;
  estimatedHours: number | null;
};

/**
 * POST /tasks (US-30). Adds the reviewed assignments to the semester, all or
 * nothing, and returns them as the server saved them, with their ids.
 * Rejects with a message the user can read.
 */
export async function addTasks(tasks: NewTask[]): Promise<Task[]> {
  // 1. Send them. If the network itself fails, send says so plainly.
  const response = await send('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });

  // 2. The server said no (e.g. 400): pass its own message on.
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  // 3. Make sure we got a list back before trusting it.
  const json: unknown = await response.json();
  if (!Array.isArray(json)) {
    throw new Error('The server sent something that is not a list of tasks');
  }
  return json as Task[];
}
/** What the task details can change (US-44): any of these, the rest stay. */
export type TaskChange = {
  /** null clears the hours. */
  estimatedHours?: number | null;
  title?: string;
  dueWeek?: number;
};

/**
 * PATCH /tasks/:id (US-44). Saves a task's changed fields (its hours, which
 * null clears, its title or its due week) and returns the task as the server
 * now holds it. Rejects with a message the user can read.
 */
export async function updateTask(id: string, change: TaskChange): Promise<Task> {
  const response = await send(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(change),
  });

  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (
    !isObject(json) ||
    json.id !== id ||
    typeof json.title !== 'string' ||
    typeof json.dueWeek !== 'number' ||
    !(json.estimatedHours === null || typeof json.estimatedHours === 'number')
  ) {
    throw new Error('The server sent invalid task data');
  }
  return json as Task;
}

/** US-23: one student's report of how long an assignment took them, as the server stored it. */
export type Review = {
  id: string;
  courseId: string;
  title: string;
  hours: number;
  comment: string;
};

/**
 * POST /courses/:id/reviews (US-23). Stores how long a finished assignment
 * took, so the crowd's data is kept. Returns the review as the server saved it.
 * Rejects with a message the user can read.
 */
export async function addReview(
  courseId: string,
  review: { title: string; hours: number; comment?: string }
): Promise<Review> {
  // 1. Send it. If the network itself fails, send says so plainly.
  const response = await send(`/courses/${encodeURIComponent(courseId)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  });

  // 2. The server said no (400 or 404): pass its own message on.
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  // 3. Make sure we got a review back before trusting it.
  const json = (await response.json()) as Partial<Review> | null;
  if (json === null || typeof json.id !== 'string') {
    throw new Error('The server sent something that is not a review');
  }
  return json as Review;

}
/** #155: the one check-in question the server chose, worded by code. */
export type CheckinQuestion = {
  courseId: string;
  /** e.g. "CS 262". */
  code: string;
  /** e.g. "Is CS 262 still on schedule?" */
  text: string;
  /** One line of why now, or null when there is none to show. */
  reason: string | null;
};

/** What the student told us: "Yes", "Something changed", or "None of these". */
export type CheckinAnswer = 'on-schedule' | 'changed' | 'none-of-these';

/** A new week and hours for one task, from "Something changed". */
export type CheckinChange = { taskId: string; dueWeek: number; estimatedHours: number | null };

/**
 * GET /checkin (#155). The question to show on the Forecast tab, or null when
 * there is none (no model key on the server, or nothing to ask). Rejects with
 * a message the user can read.
 */
export async function fetchCheckinQuestion(): Promise<CheckinQuestion | null> {
  const response = await send('/checkin');
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isObject(json) || !('question' in json)) {
    throw new Error('The server sent something that is not a check-in question');
  }
  const q = json.question;
  if (q === null) return null;
  if (!isObject(q) || typeof q.courseId !== 'string' || typeof q.text !== 'string') {
    throw new Error('The server sent something that is not a check-in question');
  }
  return q as CheckinQuestion;
}

/**
 * POST /checkin (#155). Saves the student's answer, and for "changed" the new
 * weeks and hours. Returns the tasks as the server saved them. Rejects with a
 * message the user can read.
 */
export async function answerCheckin(
  courseId: string,
  answer: CheckinAnswer,
  changes?: CheckinChange[]
): Promise<Task[]> {
  const response = await send('/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes === undefined ? { courseId, answer } : { courseId, answer, changes }),
  });

  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }

  const json: unknown = await response.json();
  if (!isObject(json) || !Array.isArray(json.tasks)) {
    throw new Error('The server sent something that is not a check-in answer');
  }
  return json.tasks as Task[];
}



/** A shared course, with the current student's enrollment status. */
export type CatalogCourse = Course & { enrolled: boolean };

function isCourse(value: unknown): value is Course {
  return isObject(value) && typeof value.id === 'string' && typeof value.code === 'string' &&
    typeof value.name === 'string' && (value.attendance === null ||
      (isObject(value.attendance) && typeof value.attendance.allowed === 'number' &&
        typeof value.attendance.used === 'number'));
}

/** GET /catalog. Searching never joins a course. */
export async function searchCatalog(q: string): Promise<CatalogCourse[]> {
  const response = await send('/catalog?q=' + encodeURIComponent(q));
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!Array.isArray(json) || !json.every((course) => isObject(course) && typeof course.enrolled === 'boolean' && isCourse(course))) {
    throw new Error('The server sent invalid course data');
  }
  return json as CatalogCourse[];
}

/** POST /courses/:id/enroll. A repeated enrollment returns the same course. */
export async function enrollInCourse(id: string): Promise<Course> {
  const response = await send('/courses/' + encodeURIComponent(id) + '/enroll', { method: 'POST' });
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!isCourse(json)) throw new Error('The server sent invalid course data');
  return json;
}

/** POST /courses. An existing code requires a separate, explicit enrollment. */
export async function createCourse(input: { code: string; name: string }): Promise<
  { created: true; course: Course } | { created: false; course: Course }
> {
  const response = await send('/courses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (response.status === 409) {
    const json: unknown = await response.json();
    if (!isObject(json) || !isCourse(json.course)) throw new Error('The server sent invalid course data');
    return { created: false, course: json.course };
  }
  if (!response.ok) {
    throw new Error((await serverErrorMessage(response)) ?? `The server answered ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!isCourse(json)) throw new Error('The server sent invalid course data');
  return { created: true, course: json };
}

