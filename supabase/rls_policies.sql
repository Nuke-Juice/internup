-- Enable RLS
alter table public.users enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.internships enable row level security;
alter table public.applications enable row level security;

-- users: self read/update
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid());

-- employer_profiles: self read/update
create policy "employer_profiles_select_own"
on public.employer_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "employer_profiles_update_own"
on public.employer_profiles
for update
to authenticated
using (user_id = auth.uid());

-- student_profiles: self read/update
create policy "student_profiles_select_own"
on public.student_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "student_profiles_update_own"
on public.student_profiles
for update
to authenticated
using (user_id = auth.uid());

-- internships: public read, employer create, employer manage own
create policy "internships_select_public"
on public.internships
for select
using (true);

create policy "internships_insert_employer"
on public.internships
for insert
to authenticated
with check (employer_id = auth.uid());

create policy "internships_update_own"
on public.internships
for update
to authenticated
using (employer_id = auth.uid());

create policy "internships_delete_own"
on public.internships
for delete
to authenticated
using (employer_id = auth.uid());

-- applications: student create/read own, employer read applications for their internships
create policy "applications_insert_student"
on public.applications
for insert
to authenticated
with check (student_id = auth.uid());

create policy "applications_select_student_own"
on public.applications
for select
to authenticated
using (student_id = auth.uid());

create policy "applications_select_employer_internships"
on public.applications
for select
to authenticated
using (
  exists (
    select 1
    from public.internships i
    where i.id = applications.internship_id
      and i.employer_id = auth.uid()
  )
);

create policy "applications_update_employer_internships"
on public.applications
for update
to authenticated
using (
  exists (
    select 1
    from public.internships i
    where i.id = applications.internship_id
      and i.employer_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.internships i
    where i.id = applications.internship_id
      and i.employer_id = auth.uid()
  )
);
