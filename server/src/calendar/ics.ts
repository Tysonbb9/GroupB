/**
 * US-49 (#165): reading the events out of a Moodle calendar export.
 *
 * An iCalendar file (RFC 5545) is lines of NAME;PARAMS:VALUE between
 * BEGIN:VEVENT and END:VEVENT. Moodle's export is simple, so this reads only
 * what the app needs: each event's id (UID), title (SUMMARY), date (DTSTART)
 * and course (CATEGORIES). Written here rather than added as a dependency,
 * because those four fields are all it needs.
 */

export type CalendarEvent = {
  /** Moodle's id for the event, stable across exports. */
  uid: string;
  title: string;
  /** When it is due, as a moment in time. */
  start: Date;
  /** Moodle puts the course's short name here, e.g. "CS262-A FA26". */
  categories: string[];
};

/** Long lines are folded: a line that starts with a space or tab continues the one before. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/** Undoes iCalendar's text escapes: \n, \, \; and \\. */
function unescape(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? ' ' : c)).trim();
}

/**
 * A DTSTART value as a moment: 20261116T235900Z (UTC), 20261116T235900 (no
 * zone, read as UTC), or 20261116 (a whole day). Null when it is not a date.
 */
export function parseIcsDate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  // Date.UTC rolls month 13 into next year and day 31 into the next month, so
  // a date that does not come back the same was never a real date.
  const real =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d) &&
    date.getUTCHours() === Number(h) &&
    date.getUTCMinutes() === Number(mi);
  return real ? date : null;
}

/** Splits "NAME;PARAM=x:VALUE" into its name and value. The value may itself hold colons. */
function splitLine(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon < 1) return null;
  const name = line.slice(0, colon).split(';')[0].toUpperCase();
  return { name, value: line.slice(colon + 1) };
}

/**
 * Every event in the file that has an id, a title and a date. Events
 * missing any of those are skipped, since they cannot become a task.
 */
export function parseIcs(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let current: { uid?: string; title?: string; start?: Date | null; categories: string[] } | null = null;

  for (const line of unfold(text)) {
    const upper = line.trim().toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = { categories: [] };
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (current?.uid && current.title && current.start) {
        events.push({ uid: current.uid, title: current.title, start: current.start, categories: current.categories });
      }
      current = null;
      continue;
    }
    if (current === null) continue;

    const parts = splitLine(line);
    if (!parts) continue;
    if (parts.name === 'UID') current.uid = parts.value.trim();
    else if (parts.name === 'SUMMARY') current.title = unescape(parts.value);
    else if (parts.name === 'DTSTART') current.start = parseIcsDate(parts.value);
    else if (parts.name === 'CATEGORIES') {
      current.categories.push(...parts.value.split(/(?<!\\),/).map(unescape).filter(Boolean));
    }
  }
  return events;
}
