-- Crunch Week database schema (Supabase 3/7).
--
-- Creates the tables from docs/DATABASE_DESIGN.md (the four live tables, Better
-- Auth's four login tables, and enrollments), with their keys and rules. Run it once on an empty project in the Supabase SQL editor, then run
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

commit;
