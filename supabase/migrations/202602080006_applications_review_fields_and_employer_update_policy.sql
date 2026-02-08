alter table public.applications
  add column if not exists status text default 'submitted',
  add column if not exists reviewed_at timestamptz null,
  add column if not exists notes text null;

alter table public.applications
  alter column status set default 'submitted';

update public.applications
set status = 'submitted'
where status is null;

update public.applications
set status = 'reviewing'
where status = 'viewed';

update public.applications
set status = 'submitted'
where status not in ('submitted', 'reviewing', 'interview', 'rejected', 'accepted');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_status_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (status in ('submitted', 'reviewing', 'interview', 'rejected', 'accepted'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_update_employer_internships'
  ) then
    create policy applications_update_employer_internships
    on public.applications
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.internships i
        where i.id = applications.internship_id
          and i.employer_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.internships i
        where i.id = applications.internship_id
          and i.employer_id = auth.uid()
      )
    );
  end if;
end
$$;
