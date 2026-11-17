-- Crunch Week migration: the Moodle events each student added (issue #165, US-49).
--
-- Adds one table, calendar_imports: which calendar event became which task,
-- so an event is not offered twice, and the week it had then, so a moved
-- deadline can be spotted later (#166). It does NOT touch tasks or any other
-- table, so saved data stays. Run it once in the Supabase SQL editor, after
-- migration.sql (#127), because it points at "user".
--
-- Safe to run twice: every statement checks first. Everything runs in one
-- transaction: if any statement fails, nothing is created.
--
-- The same table is in schema.sql and reset.sql, so building from scratch
-- gives the same database. src/__tests__/sql-files.test.ts checks that.

begin;

-- ---------------------------------------------------------------------------
-- calendar_imports: one row per Moodle event a student added as a task
-- (#165). event_uid is Moodle's id for the event; task_id is the task it
-- became; due_week is its week when added. Deleting a student deletes theirs.
-- ---------------------------------------------------------------------------
create table if not exists calendar_imports (
  user_id   text not null references "user" ("id") on delete cascade,
  event_uid text not null check (length(btrim(event_uid)) > 0),
  task_id   text not null,
  due_week  int not null check (due_week between 1 and 15),
  primary key (user_id, event_uid)
);

-- Row Level Security, as on the other tables: on, with no policies, so the
-- public key is refused. The server's secret key bypasses it.
alter table calendar_imports enable row level security;

commit;
