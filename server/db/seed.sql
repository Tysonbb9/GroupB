-- Crunch Week sample data (Supabase 3/7).
--
-- The same semester as server/src/data/semester.ts, which the in-memory
-- server uses: 1 semester row, 5 courses and 36 tasks, no reviews. Run it
-- after schema.sql, on empty tables. If semester.ts changes, change this
-- file to match.
--
-- One transaction: if any row breaks a rule, nothing is loaded.

begin;

insert into semester (id, label, current_week, weekly_capacity) values
  ('fall-2026', 'Fall 2026', 3, 15);

insert into courses (id, code, name, attendance_allowed, attendance_used) values
  ('cs262', 'CS 262', 'Software Engineering', 4, 1),
  ('cs336', 'CS 336', 'Web Development', 3, 0),
  ('math251', 'MATH 251', 'Linear Algebra', null, null),
  ('phil153', 'PHIL 153', 'Ethics', 2, 2),
  ('stat243', 'STAT 243', 'Statistics', 3, 1);

insert into tasks (id, course_id, title, category, due_week, estimated_hours, spread_weeks, done) values
  -- CS 262
  ('262-1', 'cs262', 'Team contract', 'homework', 2, 1, 1, true),
  ('262-2', 'cs262', 'Vision statement', 'writing', 3, 2, 1, false),
  ('262-3', 'cs262', 'Prototype demo', 'project', 4, 6, 2, false),
  ('262-4', 'cs262', 'Sprint 1 review', 'project', 6, 5, 1, false),
  ('262-5', 'cs262', 'Sprint 2 demo', 'project', 9, 7, 2, false),
  ('262-6', 'cs262', 'Sprint 3 demo', 'project', 12, 9, 2, false),
  ('262-7', 'cs262', 'Final presentation', 'project', 15, 8, 2, false),
  -- CS 336
  ('336-1', 'cs336', 'Lab 1: DevTools', 'homework', 2, 2, 1, true),
  ('336-2', 'cs336', 'Lab 2: Layout', 'homework', 4, 3, 1, false),
  ('336-3', 'cs336', 'Lab 3: Forms', 'homework', 6, 3, 1, false),
  ('336-4', 'cs336', 'Portfolio checkpoint', 'project', 7, 7, 2, false),
  ('336-5', 'cs336', 'Lab 5: Accessibility', 'homework', 10, 3, 1, false),
  ('336-6', 'cs336', 'Lab 6: State', 'homework', 12, 3, 1, false),
  ('336-7', 'cs336', 'Final project', 'project', 15, 18, 3, false),
  -- MATH 251
  ('m-0', 'math251', 'Syllabus quiz', 'problemSet', 2, 1, 1, false),
  ('m-1', 'math251', 'Problem set 1', 'problemSet', 3, 3, 1, false),
  ('m-2', 'math251', 'Problem set 2', 'problemSet', 5, 3, 1, false),
  ('m-3', 'math251', 'Midterm 1', 'exam', 6, 12, 2, false),
  ('m-4', 'math251', 'Problem set 3', 'problemSet', 7, 3, 1, false),
  ('m-5', 'math251', 'Problem set 4', 'problemSet', 9, 3, 1, false),
  ('m-6', 'math251', 'Problem set 5', 'problemSet', 11, 3, 1, false),
  ('m-7', 'math251', 'Midterm 2', 'exam', 12, 12, 2, false),
  ('m-8', 'math251', 'Final exam', 'exam', 15, 16, 2, false),
  -- PHIL 153
  ('p-0', 'phil153', 'Discussion post', 'writing', 3, null, 1, false),
  ('p-1', 'phil153', 'Reading response 1', 'reading', 3, 2, 1, false),
  ('p-2', 'phil153', 'Reading response 2', 'reading', 5, 2, 1, false),
  ('p-3', 'phil153', 'Essay 1', 'writing', 7, 9, 2, false),
  ('p-4', 'phil153', 'Reading response 3', 'reading', 10, 2, 1, false),
  ('p-5', 'phil153', 'Essay 2', 'writing', 13, 11, 2, false),
  ('p-6', 'phil153', 'Reading response 4', 'reading', 14, 2, 1, false),
  -- STAT 243
  ('s-1', 'stat243', 'Homework 1', 'homework', 3, 2, 1, false),
  ('s-2', 'stat243', 'Homework 2', 'homework', 5, 2, 1, false),
  ('s-3', 'stat243', 'Midterm', 'exam', 7, 9, 2, false),
  ('s-4', 'stat243', 'Homework 4', 'homework', 9, 2, 1, false),
  ('s-5', 'stat243', 'Data project', 'project', 13, 12, 3, false),
  ('s-6', 'stat243', 'Final exam', 'exam', 15, 10, 2, false);

commit;

-- Check: expect 1, 5, 36 and 0.
select
  (select count(*) from semester) as semester_rows,
  (select count(*) from courses)  as courses,
  (select count(*) from tasks)    as tasks,
  (select count(*) from reviews)  as reviews;
