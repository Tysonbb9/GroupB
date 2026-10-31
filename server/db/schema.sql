-- Crunch Week database schema (Supabase 3/7).
--
-- Creates the four tables from docs/DATABASE_DESIGN.md, with their keys and
-- rules. Run it once on an empty project in the Supabase SQL editor, then run
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
-- Row Level Security. Supabase serves every table in this schema to anyone
-- with the project's public (publishable) key, which is not a secret. Turning
-- RLS on with no policies refuses all of those requests. The server uses the
-- secret key, which bypasses RLS, so the app is not affected. Login and
-- per-user policies arrive with US-20 and US-21.
-- ---------------------------------------------------------------------------
alter table semester enable row level security;
alter table courses  enable row level security;
alter table tasks    enable row level security;
alter table reviews  enable row level security;

commit;
