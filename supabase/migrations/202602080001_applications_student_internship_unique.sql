-- Enforce one application per (student, internship) pair.
-- Keep the earliest row when duplicates already exist.
with ranked as (
  select
    id,
    row_number() over (
      partition by student_id, internship_id
      order by created_at asc nulls last, id asc
    ) as row_num
  from public.applications
)
delete from public.applications a
using ranked r
where a.id = r.id
  and r.row_num > 1;

-- Add unique constraint idempotently.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_student_id_internship_id_key'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_student_id_internship_id_key
      unique (student_id, internship_id);
  end if;
end
$$;
