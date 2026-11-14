-- Crunch Week database schema (Supabase 3/7).
--
-- Creates the tables from docs/DATABASE_DESIGN.md (the four live tables, Better
-- Auth's four login tables, enrollments, and the course tables for the AI
-- screens), with their keys and rules. Run it once on an empty project in the Supabase SQL editor, then run
-- seed.sql. To start over, run reset.sql first. See server/README.md.
--
-- The rules (CHECK constraints) match the validation in server/src/app.ts and
-- the client, so the database never rejects a value the API accepted.
--
-- Everything runs in one transaction: if any statement fails, nothing is created.

begin;

-- ---------------------------------------------------------------------------
-- semester: one row holds the whole semester (Semester in server/src/types.ts).
-- ---------------------------------------------------------------------------
create table semester (
  id              text primary key,  -- fixed sentinel, 'fall-2026'
  label           text not null,
  current_week    int not null check (current_week between 1 and 15),
  weekly_capacity numeric not null check (weekly_capacity > 0)
);

-- The app shows a single semester. Every row indexes to the same value (true),
-- so a second row breaks the unique index and is refused.
create unique index semester_one_row on semester ((true));

-- ---------------------------------------------------------------------------
-- courses (Course). attendance { allowed, used } | null becomes two columns
-- that are both empty or both set.
-- ---------------------------------------------------------------------------
create table courses (
  id                 text primary key,  -- e.g. 'cs262'
  code               text not null unique,
  name               text not null,
  attendance_allowed int check (attendance_allowed >= 0),
  attendance_used    int check (attendance_used >= 0),
  constraint attendance_both_or_neither
    check ((attendance_allowed is null) = (attendance_used is null))
);

-- ---------------------------------------------------------------------------
-- tasks (Task). A course with tasks cannot be deleted (on delete restrict),
-- so no work disappears without someone deciding to remove it.
-- ---------------------------------------------------------------------------
create table tasks (
  id              text primary key,  -- e.g. '262-2'
  course_id       text not null references courses (id) on delete restrict,
  title           text not null,
  -- Must match client/src/lib/categories.ts. Empty means not classified.
  category        text check (category in ('exam', 'project', 'problemSet', 'reading', 'writing', 'homework')),
  due_week        int not null check (due_week between 1 and 15),
  -- Empty means nobody has estimated it. Same limits as MAX_ESTIMATE_HOURS.
  estimated_hours numeric check (estimated_hours is null or (estimated_hours > 0 and estimated_hours <= 100)),
  -- Work cannot spread back before week 1.
  spread_weeks    int not null default 1 check (spread_weeks >= 1 and spread_weeks <= due_week),
  done            boolean not null default false
);

create index tasks_course_id_idx on tasks (course_id);  -- GET /tasks?courseId=

-- ---------------------------------------------------------------------------
-- reviews (Review, US-22). The database makes the id, in the same
-- 'review-1', 'review-2' form the in-memory server uses, so the data layer
-- inserts a review without an id and reads the new one back.
-- ---------------------------------------------------------------------------
create sequence review_id_seq;

create table reviews (
  id         text primary key default 'review-' || nextval('review_id_seq'),
  course_id  text not null references courses (id) on delete restrict,
  title      text not null,
  hours      numeric not null check (hours > 0 and hours <= 100),
  comment    text not null default '',
  created_at timestamptz not null default now()
);

alter sequence review_id_seq owned by reviews.id;  -- dropped with the table

create index reviews_course_id_idx on reviews (course_id);  -- GET /courses/:id/reviews

-- ---------------------------------------------------------------------------
-- Better Auth's tables (US-20, US-21; docs/LOGIN_DESIGN.md). Better Auth keeps
-- accounts and sessions here, with its own column names (camelCase, so they
-- are quoted). Its "user" table is our table of students: there is only one
-- table of users. Ids are text, like our other ids.
-- ---------------------------------------------------------------------------
create table "user" (
  "id"            text primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" boolean not null default false,
  "image"         text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table "session" (
  "id"        text primary key,
  "expiresAt" timestamptz not null,
  "token"     text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user" ("id") on delete cascade
);

create table "account" (
  "id"                    text primary key,
  "accountId"             text not null,
  "providerId"            text not null,  -- 'credential' for email and password
  "userId"                text not null references "user" ("id") on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,           -- the hashed password, never the password
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);

create table "verification" (
  "id"         text primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index "session_userId_idx"         on "session" ("userId");
create index "account_userId_idx"         on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- ---------------------------------------------------------------------------
-- enrollments: which student takes which course. A student and a course can
-- be paired once. Deleting a student removes their enrollments; a course that
-- students take cannot be deleted, like a course with tasks or reviews.
-- ---------------------------------------------------------------------------
create table enrollments (
  user_id   text not null references "user" ("id") on delete cascade,
  course_id text not null references courses (id) on delete restrict,
  primary key (user_id, course_id)
);

create index enrollments_course_id_idx on enrollments (course_id);  -- who takes a course

-- ---------------------------------------------------------------------------
-- syllabi: the text read from a course's syllabus (screen 1), kept so the
-- syllabus is not read again. One per course: a new one replaces the old.
-- Course details belong to their course, so deleting a course deletes them
-- (on delete cascade). Tasks and reviews still stop a course being deleted.
-- ---------------------------------------------------------------------------
create table syllabi (
  course_id text primary key references courses (id) on delete cascade,
  text      text not null check (length(btrim(text)) > 0)
);

-- ---------------------------------------------------------------------------
-- grade_weights: a course's graded parts (screen 1), in the syllabus's order.
-- Each part is worth more than 0% and at most 100%. That they add up to 100%
-- spans rows, so code checks it (src/rules.ts, gradeWeightsProblem).
-- ---------------------------------------------------------------------------
create table grade_weights (
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
create table course_policies (
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
create table course_checkins (
  user_id     text not null references "user" ("id") on delete cascade,
  course_id   text not null references courses (id) on delete cascade,
  answer      text not null check (answer in ('on-schedule', 'changed', 'none-of-these')),
  answered_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index course_checkins_course_id_idx on course_checkins (course_id);  -- answers about a course

-- ---------------------------------------------------------------------------
-- week_hours: a student's hours for one week, replacing their weekly number
-- that week (#148). Same limits as the weekly hours (US-32): whole hours
-- from 1 to 80. No row means the weekly number applies.
-- ---------------------------------------------------------------------------
create table week_hours (
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
-- Row Level Security. Supabase serves every table in this schema to anyone
-- with the project's public (publishable) key, which is not a secret. Turning
-- RLS on with no policies refuses all of those requests. The server uses the
-- secret key, which bypasses RLS, so the app is not affected. Better Auth
-- connects with DATABASE_URL (the postgres role), which bypasses it too.
-- Per-user policies are not needed yet: the server decides what a student sees.
-- ---------------------------------------------------------------------------
alter table semester enable row level security;
alter table courses  enable row level security;
alter table tasks    enable row level security;
alter table reviews  enable row level security;
alter table "user"         enable row level security;
alter table "session"      enable row level security;
alter table "account"      enable row level security;
alter table "verification" enable row level security;
alter table enrollments    enable row level security;
alter table syllabi         enable row level security;
alter table grade_weights   enable row level security;
alter table course_policies enable row level security;
alter table course_checkins enable row level security;
alter table week_hours      enable row level security;

commit;
