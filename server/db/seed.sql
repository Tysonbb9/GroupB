-- Crunch Week sample data (Supabase 3/7).
--
-- The shared calendar and course catalog from server/src/data/semester.ts.
-- New accounts start empty; the sample endpoint copies tasks per student.
-- Run this after schema.sql, on empty tables. Keep the catalog in sync
-- with semester.ts.
--
-- One transaction: if any row breaks a rule, nothing is loaded.

begin;

insert into semester (id, label, current_week, weekly_capacity) values
  ('fall-2026', 'Fall 2026', 3, 15);

insert into courses (id, code, code_key, name, attendance_allowed, attendance_used) values
  ('cs262', 'CS 262', 'CS262', 'Software Engineering', 4, 1),
  ('cs336', 'CS 336', 'CS336', 'Web Development', 3, 0),
  ('math251', 'MATH 251', 'MATH251', 'Linear Algebra', null, null),
  ('phil153', 'PHIL 153', 'PHIL153', 'Ethics', 2, 2),
  ('stat243', 'STAT 243', 'STAT243', 'Statistics', 3, 1);

-- Tasks are copied from server/src/data/semester.ts only when a student asks
-- for a sample. New accounts have no enrollments, tasks or settings rows.

commit;

-- Check: expect 1, 5, 0 and 0.
select
  (select count(*) from semester) as semester_rows,
  (select count(*) from courses)  as courses,
  (select count(*) from tasks)    as tasks,
  (select count(*) from reviews)  as reviews;
