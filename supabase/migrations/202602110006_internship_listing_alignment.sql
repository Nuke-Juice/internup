alter table public.internships
  add column if not exists short_summary text,
  add column if not exists remote_eligibility text;

update public.internships
set work_mode = 'on-site'
where work_mode = 'onsite';

update public.internships
set work_mode = 'hybrid'
where work_mode is null or btrim(work_mode) = '';

alter table public.internships
  alter column work_mode set default 'hybrid',
  alter column work_mode set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'internships_work_mode_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_work_mode_check;
  end if;

  alter table public.internships
    add constraint internships_work_mode_check
    check (work_mode in ('remote', 'hybrid', 'on-site'));
end
$$;
