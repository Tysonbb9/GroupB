-- Crunch Week migration: remove what nothing uses (project audit, 11/16).
--
-- syllabi, grade_weights and course_policies (and replace_grade_weights)
-- came with #144 for the AI screens, but no route or screen ever saved or
-- read them: the syllabus screen shows the grade weights and policies the AI
-- found "for your information" and does not save them. semester's
-- weekly_capacity is the same: each student's hours moved to
-- student_settings (own semester), and the server no longer reads it.
-- src/types.ts: a field no function uses and no screen draws does not
-- belong yet. They can come back with the feature that needs them.
--
-- All three tables were empty when this was written. It does NOT touch
-- courses, tasks, reviews, the login tables, enrollments, check-ins, week
-- hours or the calendar tables.
--
-- Safe to run twice: every statement checks first. Everything runs in one
-- transaction: if any statement fails, nothing is removed.

begin;

drop function if exists replace_grade_weights(text, jsonb);
drop table if exists syllabi;
drop table if exists grade_weights;
drop table if exists course_policies;
alter table semester drop column if exists weekly_capacity;

commit;
