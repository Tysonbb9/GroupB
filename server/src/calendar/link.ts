/**
 * US-48 (#164): checking a Moodle calendar link before the server fetches it.
 *
 * The server fetches the link a student pastes, so the link decides where
 * the server connects. To keep that from being turned against other
 * addresses (a server-side request forgery), only https links to an allowed
 * Moodle host are accepted: no other host, no other port, and no user name
 * or password in the link.
 */

/** Calvin's Moodle. The setting MOODLE_CALENDAR_HOSTS (comma-separated) replaces it. */
export const DEFAULT_CALENDAR_HOSTS = ['moodle.calvin.edu'];

/** The longest link accepted. A Moodle export link is about 200 characters. */
export const MAX_LINK_LENGTH = 2000;

/** The hosts the server may fetch calendars from, from the setting or the default. */
export function allowedCalendarHosts(setting: string | undefined = process.env.MOODLE_CALENDAR_HOSTS): string[] {
  const hosts = (setting ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return hosts.length > 0 ? hosts : DEFAULT_CALENDAR_HOSTS;
}

export type CheckedLink = { ok: true; url: string } | { ok: false; problem: string };

/**
 * Whether a pasted link may be fetched. The problems are written for the
 * student and never repeat the link, which holds their private token.
 */
export function checkCalendarLink(text: unknown, hosts: string[] = allowedCalendarHosts()): CheckedLink {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, problem: 'Paste your Moodle calendar link.' };
  }
  const trimmed = text.trim();
  if (trimmed.length > MAX_LINK_LENGTH) {
    return { ok: false, problem: 'That link is too long to be a Moodle calendar link.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, problem: 'That is not a link. Copy the whole calendar link from Moodle.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, problem: 'The link must start with https://.' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, problem: 'That is not a Moodle calendar link.' };
  }
  // url.port is '' for the default port, 443.
  if (url.port !== '' || !hosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, problem: `The link must be a calendar link from ${hosts.join(' or ')}.` };
  }

  return { ok: true, url: url.toString() };
}
