-- Crunch Week: delete every table (Supabase 3/7).
--
-- WARNING: this deletes ALL data in the database, including every review
-- students have saved. Only run it to rebuild from scratch, then run
-- schema.sql and seed.sql. Check with the team first.

begin;

drop table if exists reviews, tasks, courses, semester;

commit;
