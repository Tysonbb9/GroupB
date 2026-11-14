-- Crunch Week migration: users and enrollments (issue #127, part 1 of 2).
--
-- Adds Better Auth's four tables (user, session, account, verification) and
-- enrollments to a database that already exists. It does NOT touch semester,
-- courses, tasks or reviews, so saved reviews stay. Run it once in the
-- Supabase SQL editor. Part 2 (#144) has its own migration file.
--
-- Safe to run twice: every statement checks first, so a second run changes
-- nothing. Everything runs in one transaction: if any statement fails,
-- nothing is created.
--
-- The same tables are in schema.sql and reset.sql, so building from scratch
-- gives the same database.

begin;

-- ---------------------------------------------------------------------------
-- Better Auth's tables (US-20, US-21; docs/LOGIN_DESIGN.md). Better Auth keeps
-- accounts and sessions here, with its own column names (camelCase, so they
-- are quoted). Its "user" table is our table of students: there is only one
-- table of users. Ids are text, like our other ids.
-- ---------------------------------------------------------------------------
create table if not exists "user" (
  "id"            text primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" boolean not null default false,
  "image"         text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table if not exists "session" (
  "id"        text primary key,
  "expiresAt" timestamptz not null,
  "token"     text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
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

create table if not exists "verification" (
  "id"         text primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  timestamptz not null,
  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists "session_userId_idx"         on "session" ("userId");
create index if not exists "account_userId_idx"         on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");

-- ---------------------------------------------------------------------------
-- enrollments: which student takes which course. A student and a course can
-- be paired once. Deleting a student removes their enrollments; a course that
-- students take cannot be deleted, like a course with tasks or reviews.
-- ---------------------------------------------------------------------------
create table if not exists enrollments (
  user_id   text not null references "user" ("id") on delete cascade,
  course_id text not null references courses (id) on delete restrict,
  primary key (user_id, course_id)
);

create index if not exists enrollments_course_id_idx on enrollments (course_id);  -- who takes a course

-- ---------------------------------------------------------------------------
-- Row Level Security, as on the other tables: on, with no policies, so the
-- public key is refused. The server connects with DATABASE_URL (the postgres
-- role), which bypasses RLS, so login and the app are not affected.
-- ---------------------------------------------------------------------------
alter table "user"         enable row level security;
alter table "session"      enable row level security;
alter table "account"      enable row level security;
alter table "verification" enable row level security;
alter table enrollments    enable row level security;

commit;
