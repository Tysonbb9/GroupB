-- Crunch Week: delete every table (Supabase 3/7).
--
-- WARNING: this deletes ALL data in the database, including every review
-- students have saved and every student account. Only run it to rebuild from
-- scratch, then run schema.sql and seed.sql. Check with the team first.

begin;

-- The functions first: add_student_tasks returns tasks rows, so it goes
-- before that table. Then the student tables (#144, #164, #165) and
-- enrollments: they point at "user" and courses.
drop function if exists add_student_tasks(text, jsonb);
drop function if exists search_course_catalog(text, text, text);
drop function if exists create_catalog_course(text, text, text, text, text);
drop function if exists load_sample_semester(text, text[], jsonb, numeric);
drop table if exists calendar_links, calendar_imports;
drop table if exists course_checkins, week_hours;
drop table if exists student_settings, enrollments, reviews, tasks, courses, semester;
drop table if exists "session", "account", "verification", "user";

commit;
