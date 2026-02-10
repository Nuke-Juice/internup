create table if not exists public.canonical_majors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists canonical_majors_name_idx on public.canonical_majors (name);
create index if not exists canonical_majors_slug_idx on public.canonical_majors (slug);

insert into public.canonical_majors (slug, name)
values
  ('accounting', 'Accounting'),
  ('biology', 'Biology'),
  ('business_administration', 'Business Administration'),
  ('chemical_engineering', 'Chemical Engineering'),
  ('civil_engineering', 'Civil Engineering'),
  ('computer_engineering', 'Computer Engineering'),
  ('computer_science', 'Computer Science'),
  ('data_science', 'Data Science'),
  ('economics', 'Economics'),
  ('electrical_engineering', 'Electrical Engineering'),
  ('finance', 'Finance'),
  ('information_systems', 'Information Systems'),
  ('management_information_systems', 'Management Information Systems'),
  ('marketing', 'Marketing'),
  ('mathematics', 'Mathematics'),
  ('mechanical_engineering', 'Mechanical Engineering'),
  ('operations_management', 'Operations Management'),
  ('physics', 'Physics'),
  ('psychology', 'Psychology'),
  ('statistics', 'Statistics')
on conflict (slug) do update
set name = excluded.name;

alter table public.canonical_majors enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'canonical_majors' and policyname = 'canonical_majors_select_public'
  ) then
    create policy canonical_majors_select_public
      on public.canonical_majors
      for select
      using (true);
  end if;
end
$$;

alter table public.student_profiles
  add column if not exists major_id uuid;

create index if not exists student_profiles_major_id_idx on public.student_profiles (major_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_major_id_fkey'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_major_id_fkey
      foreign key (major_id)
      references public.canonical_majors(id)
      on delete set null;
  end if;
end
$$;

with profile_major_text as (
  select
    sp.user_id,
    nullif(trim(regexp_replace(split_part(trim(both '{}' from coalesce(sp.majors::text, '')), ',', 1), '^"|"$', '', 'g')), '') as major_text
  from public.student_profiles sp
  where sp.major_id is null
),
profile_major_slug as (
  select
    p.user_id,
    regexp_replace(lower(p.major_text), '[^a-z0-9]+', '_', 'g') as major_slug
  from profile_major_text p
  where p.major_text is not null
)
update public.student_profiles sp
set major_id = cm.id
from profile_major_slug p
join public.canonical_majors cm
  on cm.slug = p.major_slug
where sp.user_id = p.user_id
  and sp.major_id is null;
