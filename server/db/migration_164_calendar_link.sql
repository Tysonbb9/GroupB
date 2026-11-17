-- Crunch Week migration: each student's Moodle calendar link (issue #164, US-48).
--
-- Adds one table, calendar_links: the calendar export link a student pastes
-- once, so the app can read their due dates later (#165, #166). It does NOT
-- touch any other table, so saved data stays. Run it once in the Supabase SQL
-- editor, after migration.sql (#127), because it points at "user".
--
-- The link holds a private token, so it is a secret: only the server reads
-- it (with the secret key), and no route sends it back to the phone.
--
-- Safe to run twice: every statement checks first. Everything runs in one
-- transaction: if any statement fails, nothing is created.
--
-- The same table is in schema.sql and reset.sql, so building from scratch
-- gives the same database. src/__tests__/sql-files.test.ts checks that.

begin;

-- ---------------------------------------------------------------------------
-- calendar_links: one Moodle calendar export link per student (#164). A new
-- link replaces the old. Only https links are stored; the server checks the
-- host before saving. Deleting a student deletes their link.
-- ---------------------------------------------------------------------------
create table if not exists calendar_links (
  user_id  text primary key references "user" ("id") on delete cascade,
  url      text not null check (url like 'https://%'),
  saved_at timestamptz not null default now()
);

-- Row Level Security, as on the other tables: on, with no policies, so the
-- public key is refused. The server's secret key bypasses it.
alter table calendar_links enable row level security;

commit;
