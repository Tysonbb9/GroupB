-- Issue #116: Generate syllabus task IDs atomically per student.
-- Run this migration before deploying the matching SupabaseStore change.

create or replace function add_student_tasks(
  p_user_id text,
  p_tasks jsonb
)
returns setof tasks
language plpgsql
set search_path = public
as $$
declare
  input_task record;
  candidate text;
  suffix int;
  saved tasks%rowtype;
begin
  if p_tasks is null
     or jsonb_typeof(p_tasks) <> 'array'
     or jsonb_array_length(p_tasks) = 0 then
    raise exception 'Tasks must be a nonempty array';
  end if;

  -- Serialize task creation for this student until the transaction ends.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id, 116)
  );

  for input_task in
    select value as task
    from jsonb_array_elements(p_tasks)
  loop
    if not exists (
      select 1
      from enrollments e
      where e.user_id = p_user_id
        and e.course_id = input_task.task->>'courseId'
    ) then
      raise exception 'Student is not enrolled in course';
    end if;

    suffix := 1;

    loop
      candidate := (input_task.task->>'courseId') || '-syl-' || suffix;

      exit when not exists (
        select 1
        from tasks t
        where t.user_id = p_user_id and t.id = candidate
      );

      suffix := suffix + 1;
    end loop;

    insert into tasks (
      user_id, id, course_id, title, due_week, estimated_hours
    )
    values (
      p_user_id,
      candidate,
      input_task.task->>'courseId',
      input_task.task->>'title',
      (input_task.task->>'dueWeek')::int,
      (input_task.task->>'estimatedHours')::numeric
    )
    returning * into saved;

    return next saved;
  end loop;
end;
$$;

-- Only the trusted server may call this function.
revoke execute on function add_student_tasks(text, jsonb)
  from public, anon, authenticated;

grant execute on function add_student_tasks(text, jsonb)
  to service_role;
