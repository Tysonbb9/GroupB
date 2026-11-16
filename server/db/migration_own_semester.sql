-- Move ownerless sample tasks out of the shared database. Students can explicitly
-- copy the same sample through POST /semester/sample. Reviews and courses stay.
-- Run on an existing database after migration.sql and migration_144_course_tables.sql.
-- Repeating this transaction preserves every task that already has an owner.
begin;

-- Each student chooses their own weekly capacity; no row means fifteen hours.
create table if not exists student_settings (
  user_id         text primary key references "user" (id) on delete cascade,
  weekly_capacity numeric not null check (weekly_capacity > 0)
);

alter table tasks add column if not exists user_id text references "user" (id) on delete cascade;
delete from tasks where user_id is null;
alter table tasks alter column user_id set not null;
alter table tasks drop constraint if exists tasks_pkey;
alter table tasks add constraint tasks_pkey primary key (user_id, id);

alter table student_settings enable row level security;

-- A sample is copied all at once, only when the account has no courses or tasks.
-- Lock the student row so two concurrent requests cannot both see an empty account.
create or replace function load_sample_semester(p_user_id text, p_course_ids text[], p_tasks jsonb, p_weekly_capacity numeric)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform id from "user" where id = p_user_id for update;
  if not found then
    raise foreign_key_violation using message = 'Student does not exist';
  end if;
  if exists (select 1 from enrollments where user_id = p_user_id)
     or exists (select 1 from tasks where user_id = p_user_id) then
    return false;
  end if;

  insert into enrollments (user_id, course_id)
    select p_user_id, course_id from unnest(p_course_ids) as sample(course_id);
  insert into tasks (user_id, id, course_id, title, category, due_week, estimated_hours, spread_weeks, done)
    select p_user_id, t.id, t.course_id, t.title, t.category, t.due_week, t.estimated_hours, t.spread_weeks, t.done
    from jsonb_to_recordset(p_tasks) as t(
      id text, course_id text, title text, category text, due_week int,
      estimated_hours numeric, spread_weeks int, done boolean
    );
  -- The server supplies DEFAULT_WEEKLY_CAPACITY; keep hours the student already chose.
  insert into student_settings (user_id, weekly_capacity) values (p_user_id, p_weekly_capacity)
    on conflict (user_id) do nothing;
  return true;
end;
$$;

-- The session-checked server may copy a sample; a public client may not.
revoke execute on function load_sample_semester(text, text[], jsonb, numeric) from public, anon, authenticated;
grant execute on function load_sample_semester(text, text[], jsonb, numeric) to service_role;

commit;
