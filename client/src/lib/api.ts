import Constants from 'expo-constants';
import { Semester } from './types';

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

/** GET /semester. Rejects with a message the user can read. */
export async function fetchSemester(): Promise<Semester> {
  const baseUrl = resolveBaseUrl({
    configured: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri,
    isDev: __DEV__,
  });

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/semester`);
  } catch {
    // fetch only rejects when it could not talk to the server at all.
    throw new Error(`Could not reach the server at ${baseUrl}`);
  }

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
