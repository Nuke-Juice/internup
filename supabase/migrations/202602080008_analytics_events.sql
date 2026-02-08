create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events(user_id, created_at desc);
