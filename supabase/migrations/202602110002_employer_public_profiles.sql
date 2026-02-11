create table if not exists public.employer_public_profiles (
  employer_id uuid primary key references public.users(id) on delete cascade,
  company_name text,
  tagline text,
  about_us text,
  website text,
  industry text,
  location_city text,
  location_state text,
  avatar_url text,
  header_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employer_public_profiles enable row level security;

drop policy if exists employer_public_profiles_select_public on public.employer_public_profiles;
create policy employer_public_profiles_select_public
  on public.employer_public_profiles
  for select
  to public
  using (true);

drop policy if exists employer_public_profiles_insert_access on public.employer_public_profiles;
create policy employer_public_profiles_insert_access
  on public.employer_public_profiles
  for insert
  to authenticated
  with check (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_public_profiles_update_access on public.employer_public_profiles;
create policy employer_public_profiles_update_access
  on public.employer_public_profiles
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

drop policy if exists employer_public_profiles_delete_access on public.employer_public_profiles;
create policy employer_public_profiles_delete_access
  on public.employer_public_profiles
  for delete
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

insert into public.employer_public_profiles (
  employer_id,
  company_name,
  about_us,
  website,
  industry,
  location_city,
  location_state,
  avatar_url,
  header_image_url
)
select
  ep.user_id,
  ep.company_name,
  ep.overview,
  ep.website,
  ep.industry,
  ep.location_city,
  ep.location_state,
  ep.avatar_url,
  ep.header_image_url
from public.employer_profiles ep
where ep.user_id is not null
on conflict (employer_id) do nothing;
