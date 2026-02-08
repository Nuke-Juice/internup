create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.student_skill_items (
  student_id uuid not null references public.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level text null,
  created_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table if not exists public.internship_required_skill_items (
  internship_id uuid not null references public.internships(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, skill_id)
);

create table if not exists public.internship_preferred_skill_items (
  internship_id uuid not null references public.internships(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, skill_id)
);

create index if not exists skill_aliases_skill_id_idx on public.skill_aliases(skill_id);
create index if not exists student_skill_items_skill_id_idx on public.student_skill_items(skill_id);
create index if not exists internship_required_skill_items_skill_id_idx
  on public.internship_required_skill_items(skill_id);
create index if not exists internship_preferred_skill_items_skill_id_idx
  on public.internship_preferred_skill_items(skill_id);

alter table public.skills enable row level security;
alter table public.skill_aliases enable row level security;
alter table public.student_skill_items enable row level security;
alter table public.internship_required_skill_items enable row level security;
alter table public.internship_preferred_skill_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'skills' and policyname = 'skills_select_public'
  ) then
    create policy skills_select_public
      on public.skills
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'skill_aliases' and policyname = 'skill_aliases_select_public'
  ) then
    create policy skill_aliases_select_public
      on public.skill_aliases
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_skill_items' and policyname = 'student_skill_items_select_own'
  ) then
    create policy student_skill_items_select_own
      on public.student_skill_items
      for select
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_skill_items' and policyname = 'student_skill_items_insert_own'
  ) then
    create policy student_skill_items_insert_own
      on public.student_skill_items
      for insert
      to authenticated
      with check (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_skill_items' and policyname = 'student_skill_items_delete_own'
  ) then
    create policy student_skill_items_delete_own
      on public.student_skill_items
      for delete
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_required_skill_items' and policyname = 'internship_required_skill_items_select_public'
  ) then
    create policy internship_required_skill_items_select_public
      on public.internship_required_skill_items
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_required_skill_items' and policyname = 'internship_required_skill_items_insert_employer'
  ) then
    create policy internship_required_skill_items_insert_employer
      on public.internship_required_skill_items
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.internships i
          where i.id = internship_required_skill_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_required_skill_items' and policyname = 'internship_required_skill_items_delete_employer'
  ) then
    create policy internship_required_skill_items_delete_employer
      on public.internship_required_skill_items
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_required_skill_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_preferred_skill_items' and policyname = 'internship_preferred_skill_items_select_public'
  ) then
    create policy internship_preferred_skill_items_select_public
      on public.internship_preferred_skill_items
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_preferred_skill_items' and policyname = 'internship_preferred_skill_items_insert_employer'
  ) then
    create policy internship_preferred_skill_items_insert_employer
      on public.internship_preferred_skill_items
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.internships i
          where i.id = internship_preferred_skill_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_preferred_skill_items' and policyname = 'internship_preferred_skill_items_delete_employer'
  ) then
    create policy internship_preferred_skill_items_delete_employer
      on public.internship_preferred_skill_items
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_preferred_skill_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;
end
$$;
