alter table public.employer_profiles
  add column if not exists founded_date date;

alter table public.employer_public_profiles
  add column if not exists founded_date date;
