alter table public.applications
  add column if not exists match_score integer,
  add column if not exists match_reasons jsonb,
  add column if not exists match_gaps jsonb,
  add column if not exists matching_version text,
  add column if not exists matched_at timestamptz default now();
