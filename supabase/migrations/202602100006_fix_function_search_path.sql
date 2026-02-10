do $$
declare
  fn regprocedure;
begin
  -- Set fixed search_path for flagged functions if they exist.
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'sync_student_school_from_universities',
        'course_suggestions',
        'set_course_department_from_code'
      )
  loop
    execute format(
      'alter function %s set search_path = public, pg_temp',
      fn
    );
  end loop;
end
$$;
