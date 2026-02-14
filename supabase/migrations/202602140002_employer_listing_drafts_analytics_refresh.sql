alter table public.internships
  add column if not exists status text not null default 'draft',
  add column if not exists target_student_years text[] not null default '{}'::text[],
  add column if not exists remote_eligible_state text,
  add column if not exists remote_eligible_region text;

update public.internships
set status = case
  when is_active = true then 'published'
  else 'draft'
end
where status is null
   or btrim(status) = '';

update public.internships
set target_student_years = case
  when coalesce(target_student_year, '') in ('freshman', 'sophomore', 'junior', 'senior') then array[target_student_year]
  when coalesce(target_student_year, '') = 'any' then array['freshman', 'sophomore', 'junior', 'senior']
  else target_student_years
end
where coalesce(array_length(target_student_years, 1), 0) = 0;

update public.internships
set remote_eligible_state = coalesce(
    remote_eligible_state,
    nullif(remote_eligible_states[1], ''),
    nullif(upper(remote_eligibility), ''),
    nullif(upper(location_state), '')
  )
where work_mode in ('remote', 'hybrid')
  and remote_eligible_state is null;

update public.internships
set remote_eligible_region = case
  when remote_eligibility_scope = 'worldwide' then 'us-wide'
  when work_mode in ('remote', 'hybrid') then 'state'
  else null
end
where remote_eligible_region is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'internships_status_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_status_check;
  end if;

  alter table public.internships
    add constraint internships_status_check
    check (status in ('draft', 'published', 'archived'));

  if exists (
    select 1 from pg_constraint
    where conname = 'internships_target_student_years_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_target_student_years_check;
  end if;

  alter table public.internships
    add constraint internships_target_student_years_check
    check (
      target_student_years <@ array['freshman', 'sophomore', 'junior', 'senior']::text[]
    );

  if exists (
    select 1 from pg_constraint
    where conname = 'internships_remote_eligible_region_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_remote_eligible_region_check;
  end if;

  alter table public.internships
    add constraint internships_remote_eligible_region_check
    check (remote_eligible_region is null or remote_eligible_region in ('state', 'us-wide'));

  if exists (
    select 1 from pg_constraint
    where conname = 'internships_category_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_category_check;
  end if;

  alter table public.internships
    add constraint internships_category_check
    check (
      category is null
      or category in (
        'Finance',
        'Accounting',
        'Economics',
        'Real Estate',
        'Data Analytics',
        'Software/IT',
        'Cybersecurity',
        'Product',
        'Design',
        'Marketing',
        'Sales',
        'Operations',
        'Supply Chain',
        'HR',
        'Legal',
        'Healthcare Admin',
        'Engineering',
        'Construction/Project Mgmt',
        'Customer Success',
        'Research',
        'Nonprofit/Public Sector',
        'Education',
        'Media/Communications',
        'Strategy/Consulting'
      )
    );
end
$$;

create table if not exists public.internship_major_links (
  internship_id uuid not null references public.internships(id) on delete cascade,
  major_id uuid not null references public.canonical_majors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, major_id)
);

create index if not exists internship_major_links_major_id_idx on public.internship_major_links (major_id);

alter table public.internship_major_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'internship_major_links' and policyname = 'internship_major_links_select_public'
  ) then
    create policy internship_major_links_select_public
      on public.internship_major_links
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'internship_major_links' and policyname = 'internship_major_links_insert_employer'
  ) then
    create policy internship_major_links_insert_employer
      on public.internship_major_links
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.internships i
          where i.id = internship_major_links.internship_id
            and i.employer_id = auth.uid()
        )
        or public.is_admin_user(auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'internship_major_links' and policyname = 'internship_major_links_delete_employer'
  ) then
    create policy internship_major_links_delete_employer
      on public.internship_major_links
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_major_links.internship_id
            and i.employer_id = auth.uid()
        )
        or public.is_admin_user(auth.uid())
      );
  end if;
end
$$;

create table if not exists public.internship_events (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  event_type text not null,
  user_id uuid null references public.users(id) on delete set null,
  dedupe_key text null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint internship_events_type_check check (event_type in ('view', 'apply', 'click'))
);

create index if not exists internship_events_internship_id_created_at_idx on public.internship_events (internship_id, created_at desc);
create index if not exists internship_events_event_type_created_at_idx on public.internship_events (event_type, created_at desc);
create index if not exists internship_events_user_id_created_at_idx on public.internship_events (user_id, created_at desc);

alter table public.internship_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'internship_events' and policyname = 'internship_events_select_owner_admin'
  ) then
    create policy internship_events_select_owner_admin
      on public.internship_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_events.internship_id
            and i.employer_id = auth.uid()
        )
        or public.is_admin_user(auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'internship_events' and policyname = 'internship_events_insert_authenticated'
  ) then
    create policy internship_events_insert_authenticated
      on public.internship_events
      for insert
      to authenticated
      with check (true);
  end if;
end
$$;
