import { allowedCalendarHosts, checkCalendarLink, DEFAULT_CALENDAR_HOSTS, MAX_LINK_LENGTH } from '../calendar/link';
import { CALENDAR_TIMEOUT_MS, fetchCalendar, MAX_CALENDAR_BYTES } from '../calendar/fetch-calendar';

/**
 * US-48 (#164): the checks on a pasted Moodle calendar link, and the one
 * fetch that confirms it gives a calendar. No test fetches a real address:
 * fetch is always a fake here.
 */

const MOODLE = 'https://moodle.calvin.edu/calendar/export_execute.php?userid=123&authtoken=secret-token&preset_what=all&preset_time=recentupcoming';
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Lab 1\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';

describe('allowedCalendarHosts', () => {
  it("is Calvin's Moodle by default", () => {
    expect(allowedCalendarHosts(undefined)).toEqual(['moodle.calvin.edu']);
    expect(DEFAULT_CALENDAR_HOSTS).toEqual(['moodle.calvin.edu']);
  });

  it('can be replaced by the MOODLE_CALENDAR_HOSTS setting, comma-separated', () => {
    expect(allowedCalendarHosts(' moodle.example.edu , Other.Example.edu ')).toEqual([
      'moodle.example.edu',
      'other.example.edu',
    ]);
  });

  it('falls back to the default when the setting is blank', () => {
    expect(allowedCalendarHosts(' , ')).toEqual(DEFAULT_CALENDAR_HOSTS);
  });
});

describe('checkCalendarLink', () => {
  const hosts = ['moodle.calvin.edu'];

  it("accepts a Moodle export link from Calvin's Moodle", () => {
    expect(checkCalendarLink(MOODLE, hosts)).toEqual({ ok: true, url: MOODLE });
  });

  it('trims spaces around a pasted link', () => {
    expect(checkCalendarLink(`  ${MOODLE}\n`, hosts)).toEqual({ ok: true, url: MOODLE });
  });

  it('accepts the host in any case', () => {
    expect(checkCalendarLink('https://MOODLE.Calvin.edu/calendar/export_execute.php?x=1', hosts).ok).toBe(true);
  });

  it.each([
    ['nothing', undefined, 'Paste your Moodle calendar link.'],
    ['blank', '   ', 'Paste your Moodle calendar link.'],
    ['a number', 42, 'Paste your Moodle calendar link.'],
    ['not a link', 'my calendar', 'That is not a link. Copy the whole calendar link from Moodle.'],
    ['http, not https', 'http://moodle.calvin.edu/calendar/export_execute.php', 'The link must start with https://.'],
    ['a file link', 'file:///etc/passwd', 'The link must start with https://.'],
  ])('refuses %s', (_case, text, problem) => {
    expect(checkCalendarLink(text, hosts)).toEqual({ ok: false, problem });
  });

  it.each([
    ['another site', 'https://example.com/calendar.ics'],
    ['a look-alike host', 'https://moodle.calvin.edu.evil.example/calendar'],
    ['a subdomain of the host', 'https://x.moodle.calvin.edu/calendar'],
    ['an address on this machine', 'https://127.0.0.1/calendar'],
    ['localhost', 'https://localhost/calendar'],
    ['the cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
    ['another port on Moodle', 'https://moodle.calvin.edu:8443/calendar'],
  ])('refuses %s, so the server only ever fetches from Moodle', (_case, text) => {
    expect(checkCalendarLink(text, hosts)).toEqual({
      ok: false,
      problem: 'The link must be a calendar link from moodle.calvin.edu.',
    });
  });

  it('refuses a link with a user name or password in it', () => {
    expect(checkCalendarLink('https://user:pass@moodle.calvin.edu/calendar', hosts)).toEqual({
      ok: false,
      problem: 'That is not a Moodle calendar link.',
    });
  });

  it('refuses a link far longer than any Moodle link', () => {
    const long = `https://moodle.calvin.edu/${'a'.repeat(MAX_LINK_LENGTH)}`;
    expect(checkCalendarLink(long, hosts)).toEqual({ ok: false, problem: 'That link is too long to be a Moodle calendar link.' });
  });

  it('never repeats the link, which holds a private token, in a problem', () => {
    const results = [
      checkCalendarLink('http://moodle.calvin.edu/x?authtoken=secret-token', hosts),
      checkCalendarLink('https://example.com/x?authtoken=secret-token', hosts),
      checkCalendarLink('https://a:b@moodle.calvin.edu/x?authtoken=secret-token', hosts),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('secret-token');
    }
  });
});

/** A fake fetch that answers once with this status, body and headers, and remembers how it was called. */
function fakeFetch(status: number, body = '', headers: Record<string, string> = {}) {
  return jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(status === 204 ? null : body, { status, headers }));
}

describe('fetchCalendar', () => {
  it('accepts an iCalendar file', async () => {
    await expect(fetchCalendar(MOODLE, fakeFetch(200, ICS) as unknown as typeof fetch)).resolves.toEqual({ ok: true, text: ICS });
  });

  it('accepts one that starts with a byte-order mark or a blank line', async () => {
    const result = await fetchCalendar(MOODLE, fakeFetch(200, `﻿\r\n${ICS}`) as unknown as typeof fetch);
    expect(result.ok).toBe(true);
  });

  it('does not follow redirects, and asks with a time limit', async () => {
    const fetchFn = fakeFetch(200, ICS);
    await fetchCalendar(MOODLE, fetchFn as unknown as typeof fetch);
    const init = fetchFn.mock.calls[0][1]!;
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(CALENDAR_TIMEOUT_MS).toBe(10_000);
  });

  it('refuses a redirect, which is how Moodle answers a wrong token', async () => {
    const result = await fetchCalendar(MOODLE, fakeFetch(303, '', { Location: 'https://elsewhere.example/login' }) as unknown as typeof fetch);
    expect(result).toEqual({
      ok: false,
      reason: 'refused',
      problem: 'Moodle did not accept that link. Copy a new calendar link from Moodle.',
    });
  });

  it('refuses an error answer, and says which', async () => {
    const result = await fetchCalendar(MOODLE, fakeFetch(403, 'Forbidden') as unknown as typeof fetch);
    expect(result).toEqual({
      ok: false,
      reason: 'refused',
      problem: 'Moodle answered with an error (403). Copy a new calendar link from Moodle.',
    });
  });

  it('refuses a page that is not a calendar, such as the login page', async () => {
    const result = await fetchCalendar(MOODLE, fakeFetch(200, '<!DOCTYPE html><html>Log in</html>') as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, reason: 'not-a-calendar' });
  });

  it('refuses an empty answer', async () => {
    const result = await fetchCalendar(MOODLE, fakeFetch(200, '') as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, reason: 'not-a-calendar' });
  });

  it('refuses a calendar that says it is too large, without reading it', async () => {
    const result = await fetchCalendar(
      MOODLE,
      fakeFetch(200, ICS, { 'Content-Length': String(MAX_CALENDAR_BYTES + 1) }) as unknown as typeof fetch
    );
    expect(result).toEqual({ ok: false, reason: 'too-large', problem: 'That calendar is too large to read.' });
  });

  it('refuses a calendar that turns out too large', async () => {
    const huge = `BEGIN:VCALENDAR\r\n${'X'.repeat(MAX_CALENDAR_BYTES)}`;
    const result = await fetchCalendar(MOODLE, fakeFetch(200, huge) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, reason: 'too-large' });
  });

  it('says Moodle could not be reached when the request fails, without its error text', async () => {
    const fetchFn = jest.fn(async () => {
      throw new TypeError(`fetch failed: ${MOODLE}`);
    });
    const result = await fetchCalendar(MOODLE, fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: 'unreachable', problem: 'Moodle could not be reached. Try again in a moment.' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });
});
