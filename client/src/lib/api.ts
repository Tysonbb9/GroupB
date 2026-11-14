import Constants from 'expo-constants';
import { Semester, Task } from './types';

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
