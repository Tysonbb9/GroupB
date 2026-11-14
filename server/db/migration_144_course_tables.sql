-- Crunch Week migration: course tables for the AI screens (issue #144, part 2 of 2).
--
-- Adds what the AI screens (#123, docs/ui/ai-screens.html) save: each
-- course's syllabus text, grade weights and late and drop rules, and each
-- student's check-in answers and hours for single weeks (#148). It does NOT
-- touch semester, courses, tasks, reviews, the login tables or enrollments,
-- so saved data stays. Run it once in the Supabase SQL editor, after part 1
-- (migration.sql, #127), because two tables point at "user".
--
-- Safe to run twice: every statement checks first, so a second run changes
-- nothing. Everything runs in one transaction: if any statement fails,
-- nothing is created.
--
-- The same tables are in schema.sql and reset.sql, so building from scratch
-- gives the same database. src/__tests__/sql-files.test.ts checks that.

begin;

-- ---------------------------------------------------------------------------
-- syllabi: the text read from a course's syllabus (screen 1), kept so the
-- syllabus is not read again. One per course: a new one replaces the old.
-- Course details belong to their course, so deleting a course deletes them
-- (on delete cascade). Tasks and reviews still stop a course being deleted.
-- ---------------------------------------------------------------------------
create table if not exists syllabi (
  course_id text primary key references courses (id) on delete cascade,
  text      text not null check (length(btrim(text)) > 0)
);

-- ---------------------------------------------------------------------------
-- grade_weights: a course's graded parts (screen 1), in the syllabus's order.
-- Each part is worth more than 0% and at most 100%. That they add up to 100%
-- spans rows, so code checks it (src/rules.ts, gradeWeightsProblem).
-- ---------------------------------------------------------------------------
create table if not exists grade_weights (
  course_id text not null references courses (id) on delete cascade,
  position  int not null check (position >= 1),  -- 1 is the syllabus's first part
  name      text not null check (length(btrim(name)) > 0),
  detail    text,                                  -- e.g. 'two midterms'; empty when none
  percent   numeric not null check (percent > 0 and percent <= 100),
  primary key (course_id, position)
);

-- ---------------------------------------------------------------------------
-- course_policies: the late rule and the drop rule (screen 1). Absences
-- allowed stay on courses (attendance_allowed). The late rule is two columns
-- that are both empty or both set, like attendance on courses.
-- ---------------------------------------------------------------------------
create table if not exists course_policies (
  course_id            text primary key references courses (id) on delete cascade,
  late_percent_per_day numeric check (late_percent_per_day > 0 and late_percent_per_day <= 100),
  late_max_days        int check (late_max_days >= 1),
  drop_rule            text check (drop_rule is null or length(btrim(drop_rule)) > 0),  -- e.g. 'lowest quiz'
  constraint late_both_or_neither
    check ((late_percent_per_day is null) = (late_max_days is null))
);

-- ---------------------------------------------------------------------------
-- course_checkins: each student's latest answer to "Is this course still on
-- schedule?" (screen 2), and when they gave it. One row per student and
-- course: a new answer replaces the last. Deleting a student or a course
-- deletes their answers.
-- ---------------------------------------------------------------------------
create table if not exists course_checkins (
  user_id     text not null references "user" ("id") on delete cascade,
  course_id   text not null references courses (id) on delete cascade,
  answer      text not null check (answer in ('on-schedule', 'changed', 'none-of-these')),
  answered_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index if not exists course_checkins_course_id_idx on course_checkins (course_id);  -- answers about a course

-- ---------------------------------------------------------------------------
-- week_hours: a student's hours for one week, replacing their weekly number
-- that week (#148). Same limits as the weekly hours (US-32): whole hours
-- from 1 to 80. No row means the weekly number applies.
-- ---------------------------------------------------------------------------
create table if not exists week_hours (
  user_id text not null references "user" ("id") on delete cascade,
  week    int not null check (week between 1 and 15),
  hours   int not null check (hours between 1 and 80),
  primary key (user_id, week)
);

-- ---------------------------------------------------------------------------
-- replace_grade_weights: swaps all of a course's weights in one call. The
-- delete and the insert run in the same transaction, so a failure (an
-- unknown course, a broken rule) leaves the old weights, never half of each.
-- p_weights is a JSON array of { name, detail, percent }, in order.
-- ---------------------------------------------------------------------------
create or replace function replace_grade_weights(p_course_id text, p_weights jsonb)
returns setof grade_weights
language sql
set search_path = public
as $$
  delete from grade_weights where course_id = p_course_id;
  insert into grade_weights (course_id, position, name, detail, percent)
    select p_course_id, w.position::int, w.weight->>'name', w.weight->>'detail', (w.weight->>'percent')::numeric
    from jsonb_array_elements(p_weights) with ordinality as w(weight, position)
  returning *;
$$;

-- Only the server (the secret key's service_role) may call it, not the public key.
revoke execute on function replace_grade_weights(text, jsonb) from public, anon, authenticated;
grant execute on function replace_grade_weights(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security, as on the other tables: on, with no policies, so the
-- public key is refused. The server's secret key bypasses it.
-- ---------------------------------------------------------------------------
alter table syllabi         enable row level security;
alter table grade_weights   enable row level security;
alter table course_policies enable row level security;
alter table course_checkins enable row level security;
alter table week_hours      enable row level security;

commit;
