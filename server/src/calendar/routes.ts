import express from 'express';
import type { Store } from '../data/store';
import { fetchCalendar } from './fetch-calendar';
import { allowedCalendarHosts, checkCalendarLink } from './link';

/**
 * A student's Moodle calendar link (US-48, #164). Mounted at /calendar, behind login.
 *
 * GET  /calendar/link            -> { saved: boolean, savedAt: string | null }
 * POST /calendar/link { url }     -> 200 { saved: true, savedAt }
 *                                   400 the link is not an allowed https Moodle link
 *                                   422 Moodle answered, but not with a calendar
 *                                   502 Moodle could not be reached
 *
 * The link is checked, fetched once to make sure it gives a calendar, and
 * only then saved, replacing any earlier one. It holds a private token, so
 * no answer ever contains it, and nothing here logs it.
 *
 * fetchFn and hosts are parameters, so tests never fetch a real address.
 */
export function calendarRouter(
  store: Store,
  fetchFn: typeof fetch = fetch,
  hosts: () => string[] = () => allowedCalendarHosts()
) {
  const router = express.Router();

  router.get('/link', async (_req, res) => {
    const userId: string = res.locals.session.user.id;
    const link = await store.getCalendarLink(userId);
    res.json({ saved: link !== null, savedAt: link?.savedAt ?? null });
  });

  router.post('/link', async (req, res) => {
    const userId: string = res.locals.session.user.id;

    const checked = checkCalendarLink(req.body?.url, hosts());
    if (!checked.ok) {
      res.status(400).json({ error: checked.problem });
      return;
    }

    const fetched = await fetchCalendar(checked.url, fetchFn);
    if (!fetched.ok) {
      res.status(fetched.reason === 'unreachable' ? 502 : 422).json({ error: fetched.problem });
      return;
    }

    const link = await store.saveCalendarLink(userId, checked.url);
    res.json({ saved: true, savedAt: link.savedAt });
  });

  return router;
}
