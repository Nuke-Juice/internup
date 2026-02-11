alter table public.employer_profiles
  add column if not exists verified_employer boolean not null default false,
  add column if not exists verified_employer_manual_override boolean not null default false,
  add column if not exists email_confirmed boolean not null default false;

update public.employer_profiles ep
set email_confirmed = coalesce(u.verified, false)
from public.users u
where u.id = ep.user_id;

update public.employer_profiles ep
set verified_employer = true
from public.subscriptions s
where s.user_id = ep.user_id
  and s.status in ('active', 'trialing')
  and (
    lower(coalesce(s.price_id, '')) like '%pro%'
    or lower(coalesce(s.price_id, '')) like '%growth%'
  );

update public.internships
set employer_verification_tier = 'free'
where employer_verification_tier is distinct from 'pro';

update public.internships
set employer_verification_tier = 'pro'
where employer_id in (
  select s.user_id
  from public.subscriptions s
  where s.status in ('active', 'trialing')
    and (
      lower(coalesce(s.price_id, '')) like '%pro%'
      or lower(coalesce(s.price_id, '')) like '%growth%'
    )
);

create table if not exists public.employer_concierge_requests (
  id uuid primary key default gen_random_uuid(),
  employer_user_id uuid not null references public.users(id) on delete cascade,
  role_title text not null,
  location_or_mode text not null,
  pay_range text not null,
  hours_per_week text not null,
  description text not null,
  requirements text null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_concierge_requests_status_check check (status in ('new', 'in_progress', 'posted'))
);

create index if not exists employer_concierge_requests_employer_idx
  on public.employer_concierge_requests (employer_user_id, created_at desc);

alter table public.employer_concierge_requests enable row level security;

drop policy if exists employer_concierge_requests_select_access on public.employer_concierge_requests;
create policy employer_concierge_requests_select_access
  on public.employer_concierge_requests
  for select
  to authenticated
  using (
    employer_user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_concierge_requests_insert_access on public.employer_concierge_requests;
create policy employer_concierge_requests_insert_access
  on public.employer_concierge_requests
  for insert
  to authenticated
  with check (
    employer_user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_concierge_requests_update_access on public.employer_concierge_requests;
create policy employer_concierge_requests_update_access
  on public.employer_concierge_requests
  for update
  to authenticated
  using (public.is_admin_user((select auth.uid())))
  with check (public.is_admin_user((select auth.uid())));
