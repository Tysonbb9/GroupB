import { SupabaseStore } from '../data/supabase-store';
import { DatabaseError } from '../data/database-error';

const row = { id: 'cs262', code: 'CS 262', name: 'Software Engineering', attendance_allowed: 4, attendance_used: 1 };
let calls: { url: URL; method: string; body: any; headers: Headers }[];
let respond: (url: URL, method: string, body: any) => unknown;
beforeEach(() => {
  calls = [];
  respond = () => [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input, options) => {
    const url = new URL(String(input)), method = options?.method ?? 'GET';
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    calls.push({ url, method, body, headers: new Headers(options?.headers) });
    const result = respond(url, method, body);
    return new Response(result === undefined ? null : JSON.stringify(result), { status: result === undefined ? 204 : 200, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => jest.restoreAllMocks());
const create = () => new SupabaseStore('https://example.supabase.co', 'fake-test-key');

it('sends normalized search and student identity as RPC parameters, exposing only public fields', async () => {
  respond = () => [{ ...row, enrolled: false, code_key: 'private', user_id: 'private' }];
  const result = await create().searchCatalog('alice', ' cs_262 ');
  expect(calls).toHaveLength(1);
  expect(calls[0].url.pathname).toBe('/rest/v1/rpc/search_course_catalog');
  expect(calls[0].body).toEqual({ p_user_id: 'alice', p_code_query: 'CS262', p_name_query: 'cs_262' });
  expect(result).toEqual([{ id: row.id, code: row.code, name: row.name, attendance: { allowed: 4, used: 1 }, enrolled: false }]);
});

it('passes search punctuation as literal parameter data', async () => {
  const query = 'x%,_.)';
  await create().searchCatalog('alice', query);
  expect(calls[0].body.p_name_query).toBe(query);
  expect(calls[0].url.search).toBe('');
});

it('joins a catalog course through an idempotent student-course upsert', async () => {
  respond = (_url, method) => method === 'GET' ? [row] : undefined;
  const result = await create().enroll('alice', 'cs262');
  expect(result?.id).toBe('cs262');
  expect(calls[0].url.searchParams.get('id')).toBe('eq.cs262');
  expect(calls[0].url.searchParams.has('enrollments.user_id')).toBe(false);
  expect(calls[1].url.pathname).toBe('/rest/v1/enrollments');
  expect(calls[1].body).toEqual({ user_id: 'alice', course_id: 'cs262' });
  expect(calls[1].url.searchParams.get('on_conflict')).toBe('user_id,course_id');
  expect(calls[1].headers.get('prefer')).toContain('resolution=ignore-duplicates');
});

it('does not try enrolling an unknown course', async () => {
  expect(await create().enroll('alice', 'missing')).toBeNull();
  expect(calls).toHaveLength(1);
});

it.each([true, false])('uses one create-and-enroll transaction, returning created=%s without extra writes', async created => {
  respond = () => [{ ...row, created, code_key: 'private' }];
  const result = await create().createCourse('alice', { code: ' cs-262 ', name: ' Subject ' });
  expect(result.created).toBe(created);
  expect(result.course.id).toBe('cs262');
  expect(result.course).not.toHaveProperty('code_key');
  expect(calls).toHaveLength(1);
  expect(calls[0].url.pathname).toBe('/rest/v1/rpc/create_catalog_course');
  expect(calls[0].body).toEqual({ p_user_id: 'alice', p_code: 'cs-262', p_name: 'Subject', p_code_key: 'CS262', p_id_base: 'cs262' });
});

it('surfaces a failed atomic create without attempting a fallback enrollment', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ message: 'Transaction rejected' }), { status: 400 }));
  await expect(create().createCourse('alice', { code: 'CS999', name: 'Subject' })).rejects.toBeInstanceOf(DatabaseError);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
