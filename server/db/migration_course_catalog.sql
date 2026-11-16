-- Add catalog identity without changing course ids, enrollments or saved work.
-- Existing duplicate normalized codes make this transaction fail safely; resolve
-- that ambiguity explicitly rather than silently merging student data.
begin;

alter table courses add column if not exists code_key text;
-- Existing sample codes use the same separator rule as normalizeCourseCode.
update courses set code_key = regexp_replace(upper(code), '[[:space:]._-]', '', 'g') where code_key is null;
alter table courses alter column code_key set not null;
create unique index if not exists courses_code_key_unique on courses (code_key);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.courses'::regclass and conname = 'courses_code_length') then
    alter table courses add constraint courses_code_length check (char_length(btrim(code)) between 1 and 40 and char_length(code) <= 40);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.courses'::regclass and conname = 'courses_name_length') then
    alter table courses add constraint courses_name_length check (char_length(btrim(name)) between 1 and 200 and char_length(name) <= 200);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.courses'::regclass and conname = 'courses_code_key_present') then
    alter table courses add constraint courses_code_key_present check (char_length(code_key) > 0);
  end if;
end;
$$;

-- Literal substring matching avoids treating user punctuation as wildcards.
create or replace function search_course_catalog(p_user_id text, p_code_query text, p_name_query text)
returns table (id text, code text, name text, attendance_allowed int, attendance_used int, enrolled boolean)
language sql stable
set search_path = public
as $$
  select c.id, c.code, c.name, c.attendance_allowed, c.attendance_used,
    exists (select 1 from enrollments e where e.user_id = p_user_id and e.course_id = c.id)
  from courses c
  where (p_code_query <> '' and strpos(c.code_key, p_code_query) > 0)
     or strpos(lower(c.name), lower(p_name_query)) > 0
  order by case when p_code_query <> '' and c.code_key = p_code_query then 0
                when p_code_query <> '' and starts_with(c.code_key, p_code_query) then 1 else 2 end,
    c.code_key collate "C", c.id
  limit 10;
$$;

-- A unique-index collision waits for the winner, then returns its course without
-- enrolling this caller. A readable-id collision tries the next suffix instead.
-- Course creation and enrollment run in the same transaction and roll back together.
create or replace function create_catalog_course(
  p_user_id text, p_code text, p_name text, p_code_key text, p_id_base text
)
returns table (created boolean, id text, code text, name text, attendance_allowed int, attendance_used int)
language plpgsql
set search_path = public
as $$
declare
  existing courses%rowtype;
  saved courses%rowtype;
  candidate text := p_id_base;
  suffix int := 2;
begin
  select c.* into existing from courses c where c.code_key = p_code_key;
  if found then
    return query select false, existing.id, existing.code, existing.name, existing.attendance_allowed, existing.attendance_used;
    return;
  end if;
  loop
    begin
      insert into courses (id, code, name, code_key)
        values (candidate, p_code, p_name, p_code_key) returning courses.* into saved;
      exit;
    exception when unique_violation then
      select c.* into existing from courses c where c.code_key = p_code_key;
      if found then
        return query select false, existing.id, existing.code, existing.name, existing.attendance_allowed, existing.attendance_used;
        return;
      end if;
      candidate := p_id_base || '-' || suffix;
      suffix := suffix + 1;
    end;
  end loop;
  insert into enrollments (user_id, course_id) values (p_user_id, saved.id);
  return query select true, saved.id, saved.code, saved.name, saved.attendance_allowed, saved.attendance_used;
end;
$$;

-- The checked server supplies the student id; public clients cannot call these.
revoke execute on function search_course_catalog(text, text, text) from public, anon, authenticated;
grant execute on function search_course_catalog(text, text, text) to service_role;
revoke execute on function create_catalog_course(text, text, text, text, text) from public, anon, authenticated;
grant execute on function create_catalog_course(text, text, text, text, text) to service_role;

commit;
