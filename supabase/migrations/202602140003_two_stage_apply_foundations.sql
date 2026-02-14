alter table public.internships
  add column if not exists apply_mode text not null default 'native',
  add column if not exists external_apply_url text,
  add column if not exists external_apply_type text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'internships_apply_mode_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_apply_mode_check;
  end if;

  alter table public.internships
    add constraint internships_apply_mode_check
    check (apply_mode in ('native', 'ats_link', 'hybrid'));
end
$$;

alter table public.applications
  add column if not exists external_apply_required boolean not null default false,
  add column if not exists external_apply_completed_at timestamptz,
  add column if not exists external_apply_clicks integer not null default 0,
  add column if not exists external_apply_last_clicked_at timestamptz,
  add column if not exists quick_apply_note text;

create index if not exists applications_external_completion_idx
  on public.applications(student_id, external_apply_required, external_apply_completed_at, created_at desc);
