-- Hardening pass for launch-blocker security checks:
-- 1) Make cross-tenant table RLS explicit for core entities.
-- 2) Enforce role-based access to private resume files in storage.

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('ops_admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Core table policies
-- ---------------------------------------------------------------------------

-- users: self + admin
alter table public.users enable row level security;
drop policy if exists users_select_own on public.users;
drop policy if exists users_update_own on public.users;

drop policy if exists users_select_access on public.users;
create policy users_select_access
  on public.users
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists users_update_access on public.users;
create policy users_update_access
  on public.users
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    (
      id = (select auth.uid())
      and role is not distinct from (
        select u.role
        from public.users u
        where u.id = (select auth.uid())
      )
    )
    or public.is_admin_user((select auth.uid()))
  );

-- employer_profiles: owner + admin
alter table public.employer_profiles enable row level security;
drop policy if exists employer_profiles_select_own on public.employer_profiles;
drop policy if exists employer_profiles_update_own on public.employer_profiles;

drop policy if exists employer_profiles_select_access on public.employer_profiles;
create policy employer_profiles_select_access
  on public.employer_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_profiles_update_access on public.employer_profiles;
create policy employer_profiles_update_access
  on public.employer_profiles
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

-- student_profiles: owner + admin
alter table public.student_profiles enable row level security;
drop policy if exists student_profiles_select_own on public.student_profiles;
drop policy if exists student_profiles_update_own on public.student_profiles;

drop policy if exists student_profiles_select_access on public.student_profiles;
create policy student_profiles_select_access
  on public.student_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_profiles_insert_access on public.student_profiles;
create policy student_profiles_insert_access
  on public.student_profiles
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_profiles_update_access on public.student_profiles;
create policy student_profiles_update_access
  on public.student_profiles
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

-- internships: active listings are public, non-active rows only owner/admin.
alter table public.internships enable row level security;
drop policy if exists internships_select_public on public.internships;
drop policy if exists internships_insert_employer on public.internships;
drop policy if exists internships_update_own on public.internships;
drop policy if exists internships_delete_own on public.internships;

drop policy if exists internships_select_access on public.internships;
create policy internships_select_access
  on public.internships
  for select
  using (
    is_active = true
    or employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists internships_insert_access on public.internships;
create policy internships_insert_access
  on public.internships
  for insert
  to authenticated
  with check (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists internships_update_access on public.internships;
create policy internships_update_access
  on public.internships
  for update
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists internships_delete_access on public.internships;
create policy internships_delete_access
  on public.internships
  for delete
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

-- applications: student own + employer on owned internships + admin
alter table public.applications enable row level security;
drop policy if exists applications_insert_student on public.applications;
drop policy if exists applications_update_employer_internships on public.applications;
drop policy if exists applications_select_authenticated on public.applications;

drop policy if exists applications_select_access on public.applications;
create policy applications_select_access
  on public.applications
  for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists applications_insert_access on public.applications;
create policy applications_insert_access
  on public.applications
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists applications_update_access on public.applications;
create policy applications_update_access
  on public.applications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Private resume storage policies (storage.objects)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = excluded.public;

-- `storage.objects` is managed by Supabase Storage and already RLS-protected.
-- Avoid altering table-level ownership-managed settings in migrations.

drop policy if exists resumes_select_access on storage.objects;
create policy resumes_select_access
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (
      public.is_admin_user((select auth.uid()))
      or name like ('profiles/' || (select auth.uid()) || '/%')
      or name like ('resumes/' || (select auth.uid()) || '/%')
      or exists (
        select 1
        from public.applications a
        where a.student_id = (select auth.uid())
          and a.resume_url = name
      )
      or exists (
        select 1
        from public.applications a
        join public.internships i on i.id = a.internship_id
        where a.resume_url = name
          and i.employer_id = (select auth.uid())
      )
    )
  );

drop policy if exists resumes_insert_access on storage.objects;
create policy resumes_insert_access
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (
      public.is_admin_user((select auth.uid()))
      or name like ('profiles/' || (select auth.uid()) || '/%')
      or name like ('resumes/' || (select auth.uid()) || '/%')
    )
  );

drop policy if exists resumes_update_access on storage.objects;
create policy resumes_update_access
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (
      public.is_admin_user((select auth.uid()))
      or name like ('profiles/' || (select auth.uid()) || '/%')
      or name like ('resumes/' || (select auth.uid()) || '/%')
    )
  )
  with check (
    bucket_id = 'resumes'
    and (
      public.is_admin_user((select auth.uid()))
      or name like ('profiles/' || (select auth.uid()) || '/%')
      or name like ('resumes/' || (select auth.uid()) || '/%')
    )
  );

drop policy if exists resumes_delete_access on storage.objects;
create policy resumes_delete_access
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (
      public.is_admin_user((select auth.uid()))
      or name like ('profiles/' || (select auth.uid()) || '/%')
      or name like ('resumes/' || (select auth.uid()) || '/%')
    )
  );
