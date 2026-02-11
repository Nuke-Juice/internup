create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_webhook_events_select_admin on public.stripe_webhook_events;
create policy stripe_webhook_events_select_admin
  on public.stripe_webhook_events
  for select
  to authenticated
  using (public.is_admin_user((select auth.uid())));
