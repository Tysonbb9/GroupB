/**
 * US-48 (#164): fetching a Moodle calendar link to check it gives a calendar.
 *
 * The link is checked first (link.ts). Fetching then follows no redirects,
 * since a redirect could send the server to another address; it stops after
 * a time limit and a size limit; and the body must be an iCalendar file,
 * which starts with BEGIN:VCALENDAR. Every message is for the student and
 * never repeats the link, which holds their private token.
 */

/** How long to wait for Moodle before giving up. */
export const CALENDAR_TIMEOUT_MS = 10_000;

/** The largest calendar accepted. A semester's export is a few hundred kilobytes at most. */
export const MAX_CALENDAR_BYTES = 5 * 1024 * 1024;

export type FetchedCalendar =
  | { ok: true; text: string }
  | { ok: false; reason: 'unreachable' | 'refused' | 'not-a-calendar' | 'too-large'; problem: string };

const UNREACHABLE = 'Moodle could not be reached. Try again in a moment.';

/** Fetches a checked calendar link and makes sure it is an iCalendar file. */
export async function fetchCalendar(url: string, fetchFn: typeof fetch = fetch): Promise<FetchedCalendar> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      redirect: 'manual',
      headers: { Accept: 'text/calendar' },
      signal: AbortSignal.timeout(CALENDAR_TIMEOUT_MS),
    });
  } catch {
    // The error text of a failed request can include the address, so it is not passed on.
    return { ok: false, reason: 'unreachable', problem: UNREACHABLE };
  }

  // A redirect is not followed: Moodle sends one when the link's token is
  // wrong (to its login page), and following it could leave Moodle.
  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false,
      reason: 'refused',
      problem: 'Moodle did not accept that link. Copy a new calendar link from Moodle.',
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: 'refused',
      problem: `Moodle answered with an error (${response.status}). Copy a new calendar link from Moodle.`,
    };
  }

  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_CALENDAR_BYTES) {
    return { ok: false, reason: 'too-large', problem: 'That calendar is too large to read.' };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false, reason: 'unreachable', problem: UNREACHABLE };
  }
  if (text.length > MAX_CALENDAR_BYTES) {
    return { ok: false, reason: 'too-large', problem: 'That calendar is too large to read.' };
  }

  // An iCalendar file starts with BEGIN:VCALENDAR, possibly after a byte-order mark or blank lines.
  if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text)) {
    return {
      ok: false,
      reason: 'not-a-calendar',
      problem: 'That link did not give a calendar. In Moodle, use Export calendar, then Get calendar URL.',
    };
  }

  return { ok: true, text };
}
