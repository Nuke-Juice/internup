alter table public.internships
  add column if not exists role_category text,
  add column if not exists work_mode text,
  add column if not exists term text,
  add column if not exists hours_min integer,
  add column if not exists hours_max integer,
  add column if not exists required_skills text[] default '{}'::text[],
  add column if not exists preferred_skills text[] default '{}'::text[],
  add column if not exists resume_required boolean not null default true,
  add column if not exists application_deadline date,
  add column if not exists location_city text,
  add column if not exists location_state text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_work_mode_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_work_mode_check
      check (work_mode is null or work_mode in ('remote', 'hybrid', 'on-site'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_hours_range_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_hours_range_check
      check (
        (hours_min is null and hours_max is null)
        or (
          hours_min is not null
          and hours_max is not null
          and hours_min > 0
          and hours_max >= hours_min
        )
      );
  end if;
end
$$;
