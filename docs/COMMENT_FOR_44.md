For #44, from #127 (users and enrollments tables):

- `server/db/migration_127_users_enrollments.sql` creates Better Auth's `user`, `session`, `account` and `verification` tables, plus `enrollments`. The names and columns are Better Auth's defaults, so `server/src/auth.ts` needs no `modelName` or `fields` settings.
- The server connects with `new Pool({ connectionString: DATABASE_URL })`, as `auth.ts` already does. Use the **pooler** connection string from Dashboard > Connect (the direct one is IPv6-only on some networks).
- That connection is the `postgres` role, so it bypasses Row Level Security. RLS is on for the new tables with no policies, which only blocks the public API key.
- `enrollments.user_id` is `text` and points at `"user".id`. When #44 needs "which courses is this student in", read the user id from the session and query `enrollments` with it.
- `auth.ts` uses the memory adapter when `DATABASE_URL` is empty, so tests keep running without a database.
- Please run `npx auth@latest generate` against `auth.ts` and compare with the migration. If the CLI shows a column I missed, tell me and I will update the migration, `schema.sql` and `DATABASE_DESIGN.md`.
