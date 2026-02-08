do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_work_mode_required_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_work_mode_required_check
      check (work_mode is not null and btrim(work_mode) <> '')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_term_required_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_term_required_check
      check (term is not null and btrim(term) <> '')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_hours_sensible_bounds_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_hours_sensible_bounds_check
      check (
        hours_min is null
        or (
          hours_max is not null
          and hours_min >= 1
          and hours_max >= 1
          and hours_min <= hours_max
          and hours_min <= 80
          and hours_max <= 80
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_location_required_for_in_person_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_location_required_for_in_person_check
      check (
        work_mode not in ('hybrid', 'on-site')
        or (
          location_city is not null
          and btrim(location_city) <> ''
          and location_state is not null
          and btrim(location_state) <> ''
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_application_deadline_today_or_future_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_application_deadline_today_or_future_check
      check (
        application_deadline is null
        or application_deadline >= current_date
      )
      not valid;
  end if;
end
$$;
