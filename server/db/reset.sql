-- Crunch Week: delete every table (Supabase 3/7).
--
-- WARNING: this deletes ALL data in the database, including every review
-- students have saved and every student account. Only run it to rebuild from
-- scratch, then run schema.sql and seed.sql. Check with the team first.

begin;

-- The course details (#144) and enrollments first: they point at "user" and
-- courses. replace_grade_weights returns grade_weights rows, so it goes
-- before that table.
drop function if exists replace_grade_weights(text, jsonb);
drop table if exists syllabi, grade_weights, course_policies, course_checkins, week_hours;
drop table if exists enrollments, reviews, tasks, courses, semester;
drop table if exists "session", "account", "verification", "user";

commit;
