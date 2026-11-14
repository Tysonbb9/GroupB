-- Crunch Week: delete every table (Supabase 3/7).
--
-- WARNING: this deletes ALL data in the database, including every review
-- students have saved and every student account. Only run it to rebuild from
-- scratch, then run schema.sql and seed.sql. Check with the team first.

begin;

-- enrollments first: it points at both "user" and courses.
drop table if exists enrollments, reviews, tasks, courses, semester;
drop table if exists "session", "account", "verification", "user";

commit;
