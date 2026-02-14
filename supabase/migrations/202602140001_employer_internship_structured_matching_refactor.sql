alter table public.internships
  add column if not exists pay_min integer,
  add column if not exists pay_max integer,
  add column if not exists target_student_year text,
  add column if not exists desired_coursework_strength text,
  add column if not exists remote_eligibility_scope text,
  add column if not exists remote_eligible_states text[] not null default '{}'::text[];

update public.internships
set pay_min = coalesce(pay_min, floor(pay_min_hourly)::int),
    pay_max = coalesce(pay_max, floor(pay_max_hourly)::int)
where pay_min is null or pay_max is null;

update public.internships
set target_student_year = case
  when lower(coalesce(experience_level, '')) = 'entry' then 'freshman'
  when lower(coalesce(experience_level, '')) = 'mid' then 'junior'
  when lower(coalesce(experience_level, '')) = 'senior' then 'senior'
  when lower(coalesce(experience_level, '')) in ('freshman', 'sophomore', 'junior', 'senior', 'any') then lower(experience_level)
  else coalesce(target_student_year, 'any')
end
where target_student_year is null;

update public.internships
set desired_coursework_strength = coalesce(desired_coursework_strength, 'low')
where desired_coursework_strength is null;

update public.internships
set remote_eligibility_scope = case
  when work_mode = 'remote' then 'worldwide'
  when work_mode = 'hybrid' then 'us_only'
  else null
end
where remote_eligibility_scope is null and work_mode in ('remote', 'hybrid');

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'internships_experience_level_enum_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_experience_level_enum_check;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'internships_target_student_year_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_target_student_year_check
      check (target_student_year is null or target_student_year in ('freshman', 'sophomore', 'junior', 'senior', 'any'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'internships_desired_coursework_strength_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_desired_coursework_strength_check
      check (desired_coursework_strength is null or desired_coursework_strength in ('low', 'medium', 'high'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'internships_pay_range_numeric_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_pay_range_numeric_check
      check (
        pay_min is null
        or (
          pay_min >= 0
          and pay_max is not null
          and pay_max >= pay_min
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'internships_remote_eligibility_scope_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_remote_eligibility_scope_check
      check (remote_eligibility_scope is null or remote_eligibility_scope in ('worldwide', 'us_only', 'us_states'));
  end if;
end
$$;

create table if not exists public.canonical_course_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.canonical_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  category_id uuid not null references public.canonical_course_categories(id) on delete restrict,
  level text not null,
  created_at timestamptz not null default now(),
  unique (code, category_id)
);

create table if not exists public.student_courses (
  student_profile_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.canonical_courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_profile_id, course_id)
);

create table if not exists public.internship_required_course_categories (
  internship_id uuid not null references public.internships(id) on delete cascade,
  category_id uuid not null references public.canonical_course_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, category_id)
);

create index if not exists canonical_courses_category_id_idx on public.canonical_courses(category_id);
create index if not exists student_courses_student_profile_id_idx on public.student_courses(student_profile_id);
create index if not exists student_courses_course_id_idx on public.student_courses(course_id);
create index if not exists internship_required_course_categories_category_id_idx on public.internship_required_course_categories(category_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'canonical_courses_level_check'
      and conrelid = 'public.canonical_courses'::regclass
  ) then
    alter table public.canonical_courses
      add constraint canonical_courses_level_check
      check (level in ('intro', 'intermediate', 'advanced'));
  end if;
end
$$;

alter table public.canonical_course_categories enable row level security;
alter table public.canonical_courses enable row level security;
alter table public.student_courses enable row level security;
alter table public.internship_required_course_categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='canonical_course_categories' and policyname='canonical_course_categories_select_public'
  ) then
    create policy canonical_course_categories_select_public
      on public.canonical_course_categories
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='canonical_courses' and policyname='canonical_courses_select_public'
  ) then
    create policy canonical_courses_select_public
      on public.canonical_courses
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_courses' and policyname='student_courses_select_own'
  ) then
    create policy student_courses_select_own
      on public.student_courses
      for select
      to authenticated
      using (student_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_courses' and policyname='student_courses_insert_own'
  ) then
    create policy student_courses_insert_own
      on public.student_courses
      for insert
      to authenticated
      with check (student_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='student_courses' and policyname='student_courses_delete_own'
  ) then
    create policy student_courses_delete_own
      on public.student_courses
      for delete
      to authenticated
      using (student_profile_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_required_course_categories' and policyname='internship_required_course_categories_select_public'
  ) then
    create policy internship_required_course_categories_select_public
      on public.internship_required_course_categories
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_required_course_categories' and policyname='internship_required_course_categories_insert_employer'
  ) then
    create policy internship_required_course_categories_insert_employer
      on public.internship_required_course_categories
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.internships i
          where i.id = internship_required_course_categories.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='internship_required_course_categories' and policyname='internship_required_course_categories_delete_employer'
  ) then
    create policy internship_required_course_categories_delete_employer
      on public.internship_required_course_categories
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_required_course_categories.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;
end
$$;

insert into public.canonical_course_categories (slug, name)
values
  ('finance-accounting', 'Finance & Accounting'),
  ('data-analytics', 'Data & Analytics'),
  ('software-engineering', 'Software Engineering'),
  ('marketing', 'Marketing'),
  ('operations', 'Operations'),
  ('product', 'Product')
on conflict (slug) do update
set name = excluded.name;

insert into public.canonical_courses (code, name, category_id, level)
select values_map.code, values_map.name, c.id, values_map.level
from (
  values
    ('FIN 2010', 'Financial Accounting', 'finance-accounting', 'intro'),
    ('FIN 3300', 'Corporate Finance', 'finance-accounting', 'intermediate'),
    ('ACCT 3100', 'Managerial Accounting', 'finance-accounting', 'intermediate'),
    ('DS 2500', 'Data Analytics Foundations', 'data-analytics', 'intro'),
    ('STAT 3010', 'Probability & Statistics', 'data-analytics', 'intermediate'),
    ('CS 2420', 'Data Structures', 'software-engineering', 'intermediate'),
    ('CS 3500', 'Software Practice', 'software-engineering', 'advanced'),
    ('MKTG 3010', 'Marketing Management', 'marketing', 'intro'),
    ('MKTG 4200', 'Marketing Analytics', 'marketing', 'advanced'),
    ('OPS 3200', 'Operations Management', 'operations', 'intermediate'),
    ('OPS 3600', 'Supply Chain Fundamentals', 'operations', 'intermediate'),
    ('PROD 3000', 'Product Management Foundations', 'product', 'intro')
) as values_map(code, name, category_slug, level)
join public.canonical_course_categories c
  on c.slug = values_map.category_slug
on conflict (code, category_id) do update
set
  name = excluded.name,
  level = excluded.level;

insert into public.skills (slug, label, category)
values
  ('financial-analysis', 'Financial Analysis', 'Finance'),
  ('bookkeeping', 'Bookkeeping', 'Finance'),
  ('data-cleaning', 'Data Cleaning', 'Data'),
  ('a-b-testing', 'A/B Testing', 'Marketing'),
  ('stakeholder-management', 'Stakeholder Management', 'Business'),
  ('api-design', 'API Design', 'Software'),
  ('quality-assurance', 'Quality Assurance', 'Software'),
  ('erp-systems', 'ERP Systems', 'Operations'),
  ('supply-chain-planning', 'Supply Chain Planning', 'Operations'),
  ('user-interviews', 'User Interviews', 'Design')
on conflict (slug) do update
set
  label = excluded.label,
  category = excluded.category;
